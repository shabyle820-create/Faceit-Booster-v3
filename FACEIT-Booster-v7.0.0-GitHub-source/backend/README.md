# FACEIT Booster Backend

A restricted Express API for FACEIT Booster. The FACEIT key exists only in `FACEIT_API_KEY`; responses never include it. There is no general-purpose proxy route.

## Endpoints

- `GET /health`
- `GET /api/matches/:matchId` (15-second cache)
- `GET /api/players/:playerId` (5-minute cache)
- `GET /api/players/:playerId/stats` (2-minute cache; CS2 with CS:GO fallback)
- `GET /api/players/by-nickname/:nickname` (5-minute cache)

All parameters are allow-list validated. Requests are limited to 60 per minute per IP. Browser CORS access is restricted to the comma-separated Chrome extension IDs configured in `CHROME_EXTENSION_IDS`.

## Local development

Requires Node.js 20 or newer.

```sh
npm install
copy .env.example .env
npm test
npm start
```

Edit `.env` locally. Never commit it:

```dotenv
FACEIT_API_KEY=your_real_key
CHROME_EXTENSION_IDS=your_32_character_extension_id
PORT=3000
```

Multiple published extension IDs can be comma-separated. Verify deployment with `GET /health`.

## Railway

1. Create a new Railway project and choose **Deploy from GitHub repo**.
2. Set the service root directory to `backend`.
3. Add `FACEIT_API_KEY` and `CHROME_EXTENSION_IDS` under **Variables**. Do not set the key in source or build arguments.
4. Railway detects `package.json`; the start command is `npm start`. Generate a public domain under **Networking**.
5. Put that HTTPS origin into the extension's `BACKEND_BASE_URL` and `host_permissions`, then reload the extension.

Railway supplies `PORT` automatically.

## Render

1. Create a **Web Service** from the repository.
2. Set **Root Directory** to `backend`, **Runtime** to Node, **Build Command** to `npm install`, and **Start Command** to `npm start`.
3. Add secret environment variables `FACEIT_API_KEY` and `CHROME_EXTENSION_IDS`.
4. Deploy, then put the Render HTTPS origin into the extension's `BACKEND_BASE_URL` and `host_permissions` and reload the extension.

Render supplies `PORT` automatically. A free service may sleep; the first request after inactivity can therefore be slower.
