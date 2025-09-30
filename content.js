(() => {
  // --- target routes ---
  const RX_GROW = /^https:\/\/www\.linkedin\.com\/mynetwork\/grow\/?(\?.*)?$/i;
  const RX_RECEIVED = /^https:\/\/www\.linkedin\.com\/mynetwork\/invitation-manager\/received\/?(\?.*)?$/i;

  // pacing
  const CLICK_DELAY_MS = 650, WAVE_PAUSE_MS = 900, MAX_WAVES = 20;
  const OBS_DEBOUNCE_MS = 200;

  // locale (EN/AR)
  const lang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
  const isAR = lang.startsWith('ar');
  const I18N = {
    acceptAll: isAR ? 'قبول الكل' : 'Accept all',
    ignoreAll: isAR ? 'تجاهل الكل' : 'Ignore all',
    done: isAR ? 'تمت المعالجة' : 'Done',
    powered: isAR ? 'بدعم من Emran Alhaddad' : 'Powered by Emran Alhaddad'
  };

  // utils
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const isGrow = () => RX_GROW.test(location.href);
  const isReceived = () => RX_RECEIVED.test(location.href);
  const isTarget = () => isGrow() || isReceived();
  const visible = (el) => {
    if (!el) return false;
    const s = getComputedStyle(el);
    if (s.visibility !== 'visible' || s.display === 'none') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  // --- robust SPA route detection (URL watcher + popstate) ---
  let urlWatchTimer = null;
  function startUrlWatcher() {
    stopUrlWatcher();
    let last = location.href;
    urlWatchTimer = setInterval(() => {
      if (location.href !== last) {
        last = location.href;
        onRouteChange();
      }
    }, 250);
    addEventListener('popstate', onRouteChange);
  }
  function stopUrlWatcher() {
    if (urlWatchTimer) { clearInterval(urlWatchTimer); urlWatchTimer = null; }
    removeEventListener('popstate', onRouteChange);
  }

  // state
  let observer = null;
  let initializedFor = '';
  let running = false;
  let stickTimer = null;  // short reattach window after load

  // boot
  ready(() => { startUrlWatcher(); bootstrap(); });
  function ready(cb) { document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', cb, { once: true }) : cb(); }
  function onRouteChange() { teardown(); setTimeout(bootstrap, 150); }

  function bootstrap() {
    if (!isTarget()) { teardown(); return; }
    // allow re-init across SPA navigations even if same href reappears later
    initializedFor = location.href;

    ensurePanelAtAnchors();                 // show ASAP

    if (observer) observer.disconnect();
    observer = new MutationObserver(debounce(() => {
      ensurePanelAtAnchors();               // re-anchor if LI replaced DOM
      updateCounts();
    }, OBS_DEBOUNCE_MS));
    observer.observe(document.body, { childList: true, subtree: true });

    // first ~5s: re-check anchors aggressively (handles late hydration)
    let tries = 0;
    clearInterval(stickTimer);
    stickTimer = setInterval(() => {
      if (!isTarget()) { clearInterval(stickTimer); return; }
      ensurePanelAtAnchors();
      if (++tries > 20) clearInterval(stickTimer); // ~5s at 250ms
    }, 250);

    setTimeout(updateCounts, 80);
  }

  function teardown() {
    initializedFor = '';
    if (observer) { observer.disconnect(); observer = null; }
    clearInterval(stickTimer);
    const panel = document.getElementById('lih-panel'); if (panel) panel.remove();
  }

  // panel + buttons
  function makeBtn(kind, icon, text, handler) {
    const btn = document.createElement('button');
    btn.id = `lih-${kind}`;
    btn.className = `lih-btn lih-${kind}`;
    btn.innerHTML = `
      <span class="label">
        <span class="lih-icon">${icon}</span>
        <span class="text">${text}</span>
        <span class="count" id="lih-${kind}-count">0</span>
        <span class="spinner"></span>
      </span>
    `;
    btn.addEventListener('click', handler);
    return btn;
  }

  function buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'lih-panel';
    panel.classList.add('lih-hidden');   // NEW: start hidden
    panel.appendChild(makeBtn('accept', '✓', I18N.acceptAll, () => bulkClick('accept')));
    panel.appendChild(makeBtn('ignore', '×', I18N.ignoreAll, () => bulkClick('ignore')));
    return panel;
  }

  // returns true if anchored inline, false if not found
  function anchorPanel(panel) {
    if (isGrow()) {
      // After the row that contains h2 "Invitations (N)"
      const root = document.querySelector('[componentkey="MyNetwork_InvitationsPreview"]');
      const h2 = root?.querySelector('h2');
      const row = h2?.closest('div') || root?.firstElementChild;
      if (row && row.parentNode) { row.parentNode.insertBefore(panel, row.nextSibling); return true; }
    }
    if (isReceived()) {
      // Before the main invitations section
      const main = document.querySelector('div[role="main"][data-sdui-screen*="InvitationReceivedWithType"]');
      if (main && main.parentNode) { main.parentNode.insertBefore(panel, main); return true; }
    }
    return false;
  }

  function ensurePanelAtAnchors() {
    if (!isTarget()) { teardown(); return; }

    let panel = document.getElementById('lih-panel');

    // If LI removed it, rebuild
    const needsBuild = !panel || !document.body.contains(panel);
    if (needsBuild) panel = buildPanel();

    // Not already anchored? (LinkedIn might have removed the old parent)
    const anchored = panel.parentElement && (isGrow()
      ? !!panel.previousElementSibling
      : !!panel.parentElement && isReceived());

    if (!anchored) {
      // If it already exists somewhere, remove before re-anchoring
      if (panel.parentElement) panel.parentElement.removeChild(panel);
      const ok = anchorPanel(panel);
      if (!ok) {
        // If anchors not present *yet*, keep panel detached (don’t show elsewhere).
        return;
      }
    }
  }

  // counts from the badges you specified
  function parseCountFromText(s) {
    const m = typeof s === 'string' && s.match(/\((\d+)\)/);
    return m ? parseInt(m[1], 10) : 0;
  }

  function getCount() {
    if (isGrow()) {
      const h2 = document.querySelector('[componentkey="MyNetwork_InvitationsPreview"] h2');
      return parseCountFromText(h2?.textContent || '');
    }
    if (isReceived()) {
      const firstLi = document.querySelector('div[role="main"][data-sdui-screen*="InvitationReceivedWithType"] nav ul li:first-of-type');
      return parseCountFromText(firstLi?.textContent || '');
    }
    return 0;
  }

  function updateCounts() {
    const n = getCount();
    const a = document.getElementById('lih-accept-count');
    const i = document.getElementById('lih-ignore-count');
    if (a) a.textContent = String(n);
    if (i) i.textContent = String(n);
  
    const accept = document.getElementById('lih-accept');
    const ignore = document.getElementById('lih-ignore');
    const disabled = n === 0;
    [accept, ignore].forEach(b => { if (b) b.disabled = disabled; });
  
    // NEW: hide/show panel itself
    const panel = document.getElementById('lih-panel');
    if (panel) {
      if (n === 0) {
        panel.classList.add('lih-hidden');
      } else {
        panel.classList.remove('lih-hidden');
      }
    }
  }
  

  // invitation discovery (structure-based, no labels)
  function getInvitationCards() {
    const containers = [];
    if (isGrow()) containers.push(document.querySelector('[componentkey="MyNetwork_InvitationsPreview"]'));
    if (isReceived()) containers.push(document.querySelector('div[role="main"][data-sdui-screen*="InvitationReceivedWithType"]'));
    const roots = containers.filter(Boolean);
    if (!roots.length) return [];

    const seen = new WeakSet();
    const cards = [];
    for (const root of roots) {
      root.querySelectorAll('div[data-view-name="pending-invitation"]').forEach(node => {
        const listItem = node.closest('[role="listitem"]') || node.parentElement;
        const btns = (listItem || node).querySelectorAll('div[data-view-name="invitation-action"] button');
        if (btns.length >= 2 && visible(btns[0]) && visible(btns[1]) && !seen.has(listItem || node)) {
          seen.add(listItem || node);
          cards.push({ node: listItem || node, accBtn: btns[1], ignBtn: btns[0] }); // 0=Ignore, 1=Accept
        }
      });
    }
    return cards;
  }

  // bulk click
  async function bulkClick(kind) {
    if (running) return;
    running = true;
    setBusy(true);

    let total = 0;
    for (let wave = 0; wave < MAX_WAVES; wave++) {
      const cards = getInvitationCards();
      if (!cards.length) break;

      for (const c of cards) {
        try {
          const btn = (kind === 'accept') ? c.accBtn : c.ignBtn;
          c.node.scrollIntoView({ block: 'center' });
          await sleep(120);  // allow scroll to settle
          btn.click();
          total++;
        } catch { }
        await sleep(CLICK_DELAY_MS);
      }
      await sleep(WAVE_PAUSE_MS);
      updateCounts();
    }

    setBusy(false);
    running = false;
    toast(`${I18N.done} (${total}) — ${I18N.powered}`);
  }

  function setBusy(state) {
    ['accept', 'ignore'].forEach(k => {
      const b = document.getElementById(`lih-${k}`);
      if (b) b.disabled = state;
      if (b) b.classList.toggle('running', state);
    });
  }

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'lih-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  // clean up watcher when the content script is torn down (tab close / reload)
  addEventListener('unload', stopUrlWatcher);
})();
