# FACEIT Booster

FACEIT Booster is a Chrome Manifest V3 extension that enhances FACEIT matchrooms with team and player Elo, country flags, performance data, smurf-risk estimates, Elo estimates, leader highlighting, and optional ready-up and party automation.

The repository contains two separate deliverables:

- The browser extension is in the repository root.
- The restricted FACEIT API service is in `backend/`.

The FACEIT API key must exist only in the backend host's secret environment variables. Never put it in extension files or commit it to GitHub.

## Local extension test

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose this repository's root folder.
4. Open a FACEIT matchroom and use the extension popup.

## Fresh GitHub and Render deployment

1. Create a new GitHub repository and push this complete project.
2. In Render, create a new **Blueprint** from the repository. Render reads `render.yaml`, deploys only `backend/`, and checks `/health`.
3. Enter `FACEIT_API_KEY` and `CHROME_EXTENSION_IDS` when Render requests the secret environment variables.
4. If Render assigns a different service URL, update both `BACKEND_BASE_URL` in `background.js` and the matching entry in `manifest.json`.
5. Confirm `https://YOUR-SERVICE.onrender.com/health` returns `{ "status": "ok" }`.
6. Rebuild the extension ZIP after any backend URL change.

For an unpacked extension, Chrome shows the 32-character extension ID on `chrome://extensions`. After Chrome Web Store publication, replace `CHROME_EXTENSION_IDS` in Render with the published extension ID and redeploy.

## Chrome Web Store package

Upload a ZIP whose root contains `manifest.json`, not a ZIP containing the outer project folder. The upload package should contain only:

- `manifest.json`
- `background.js`
- `content.js`
- `content.css`
- `popup.html`
- `popup.js`
- `popup.css`
- `logo.png`
- `icons/`

Do not include `backend/`, `.env` files, Git metadata, `render.yaml`, or documentation in the Chrome Web Store ZIP.

## Privacy

See [PRIVACY.md](PRIVACY.md). The extension stores settings in Chrome sync storage and requests FACEIT match/player data through the restricted backend. It does not contain or expose the FACEIT API key.
