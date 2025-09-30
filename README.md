# LinkedIn Invites Helper

One-click **Accept all** / **Ignore all** for LinkedIn invitations.  
Buttons appear inline on:
- `https://www.linkedin.com/mynetwork/grow/`
- `https://www.linkedin.com/mynetwork/invitation-manager/received/`

- 🌐 Auto-detects locale (EN/AR)  
- 🧠 Survives LinkedIn SPA navigation & rehydration  
- 🫥 Hides itself when there are zero invitations  
- 🛡️ No tracking. No data leaves your browser.

## Install (Chrome)
1. Download from the Chrome Web Store (link here once published).
2. Open the two LinkedIn pages above and you’ll see inline controls.

## Permissions
- **None** beyond running on the two LinkedIn URLs via content scripts.
- The extension **does not collect, transmit, or store** any personal data.

## Usage
- Click **Accept all** or **Ignore all**.  
- Progress is throttled to reduce the chance of rate limits.  
- When done, a small toast is shown (“Powered by Emran Alhaddad”).

## Development
- `manifest.json` (MV3)
- `content.js` — injects panel, handles SPA routing, bulk actions
- `styles.css` — animations & layout
- `icons/` — 16/48/128 PNGs

### Load unpacked (dev)
1. `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this folder

### Release
- Bump version in `manifest.json`
- Zip the folder and upload to the Chrome Web Store

## Notes / Disclaimer
This tool simulates clicking buttons you could click manually.  
Use responsibly and at your own risk. Automated interactions **may** violate the terms of some services. The author collects no data and provides no warranty.

## License
MIT © Emran Alhaddad
