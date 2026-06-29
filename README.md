# ONDC Coding Interview Tool

A minimal **real-time collaborative code editor** for one-on-one DSA coding
interviews, built for **ONDC** (Open Network for Digital Commerce). Two people
open the same secret link and edit a single shared file together — live,
conflict-free, with each other's cursor and selection visible.

## Features

- **Admin-gated sessions.** Only an admin (username/password) can create a
  session; the secret link is then shared with one candidate who joins without
  logging in. An **admin dashboard** lists live sessions with their connection
  counts and lets the admin copy/open/end each.
- **Single shared file**, full-screen editor. No file tree, no tabs.
- **Syntax highlighting** with a language selector: Python, JavaScript, Java,
  C++, and Plain Text (`.txt`). Switching language updates highlighting for
  **both** users in real time (the choice is part of the shared document).
- **Conflict-free collaborative editing** via [Yjs](https://yjs.dev) (a CRDT) —
  no full-document broadcasts, no lost keystrokes or cursor jumping when both
  type at once.
- **Remote cursors & selections** shown in each user's distinct color.
- **Secret room IDs** in the URL (e.g. `/s/Ab3xY7Qz...`, 16 random base62
  chars), minted server-side only by an admin. Anyone with the link joins; an
  unknown link is rejected ("Session not found").
- **Hard cap of 2 users per room, enforced on the server.** A third visitor is
  rejected with a clear "Session is full" screen and never joins the document.
- **Presence indicator** ("2/2 connected") plus connection status.
- **Admin dashboard** to create sessions and monitor live ones; **Copy link**
  button in-session.

## Tech

- Editor: **CodeMirror 6**
- Shared state: **Yjs** + `y-websocket` provider + `y-codemirror.next` binding
- **Frontend** (`client/`): **React + Vite + TypeScript**, dark theme
- **Backend** (`server/`): **Express + TypeScript** — runs the `y-websocket`
  sync server, enforces the 2-user cap, and serves the built client

## Project structure

```
.
├── client/            # React + Vite + TS frontend
│   └── src/           #   Landing, Session, editor, brand
├── server/            # Express + TS backend
│   └── src/           #   index, app, config, logger, ws/, routes/
├── Dockerfile         # multi-stage build (client + server -> one image)
├── docker-compose.yml # run the image (locally or on the EC2)
├── .github/workflows/ # CI/CD: deploy.yml (build image -> ship to EC2)
└── package.json       # root orchestrator scripts driving both projects
```

The frontend and backend are independent npm projects (own `package.json` /
lockfile). The root `package.json` provides convenience scripts that drive both.

## Prerequisites

- Node.js 18+ (developed on Node 24)

## Install

```bash
npm install            # root tooling (concurrently)
npm run install:all    # installs client/ and server/ deps
```

## Run locally (development, with hot reload)

Starts the Express/y-websocket backend on `:1234` (via `tsx watch`) and the Vite
dev server on `:5173` together:

```bash
npm run dev
```

Then open **http://localhost:5173**, sign in at `/login` (`admin` /
`ONDC@0001`), and click **Create new session** on the dashboard.

To test collaboration, open the resulting `/s/...` link in a second browser
window. Open it in a **third** window to see the "Session is full" rejection.

## Run locally (production build, single server)

Build both projects, then start the server which serves the built client and
handles WebSocket sync on the same port:

```bash
npm run build
npm start
```

Then open **http://localhost:1234**.

## Configuration

Backend (`server/`) env vars:

- `PORT` — port serving HTTP + WebSocket (default `1234`).
- `HOST` — bind address (default `0.0.0.0`).
- `MAX_USERS_PER_ROOM` — per-room cap (default `2`).
- `CLIENT_DIST` — path to the built client (default `../client/dist`).
- `NODE_ENV` — `production` enables combined logging.
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — admin login that gates session creation
  (defaults `admin` / `ONDC@0001`, also set in `server/.env`).
- `ADMIN_TOKEN_TTL_MIN` — admin login token lifetime in minutes (default `720`).

The server reads `server/.env` (via `dotenv`); copy `server/.env.example` to
`server/.env` to override the built-in defaults.

## Admin & sessions

- Open the app → you're sent to **`/login`**. Sign in with the admin
  credentials → **`/admin`** dashboard.
- Click **Create new session** to mint a secret room and copy its `/s/<id>`
  link; share it with the candidate (no login needed to join).
- The server only accepts WebSocket connections to **admin-created** rooms;
  unknown/ended links show a "Session not found" screen (close code `4004`).
- Sessions live in memory — they're lost on server restart (admin must re-login
  and re-create), matching the already-ephemeral CRDT documents.

API: `POST /api/login` → `{ token }`; `POST /api/sessions`, `GET /api/sessions`,
`DELETE /api/sessions/:roomId` (all require `Authorization: Bearer <token>`).

Frontend (`client/`) env vars (Vite):

- `VITE_WS_URL` — explicit WebSocket URL override (optional).
- `VITE_WS_PORT` — dev backend port (default `1234`). In dev the client derives
  the WS host from the page URL, so localhost **and** a LAN/remote IP both work.
  In a production build it uses the same origin that served the page.

Health check: `GET /healthz` returns `{ status, uptimeSeconds, rooms, connections }`.

## Docker

The whole app builds into a single image (multi-stage `Dockerfile`): the client
is built with Vite, the server with `tsc`, and the runtime stage serves both on
port `1234`.

Run it locally:

```bash
docker compose up --build
# open http://localhost:1234
```

## Behind nginx (reverse proxy)

No app code changes are needed: the client uses a **same-origin** WebSocket
(`wss://<your-domain>/<roomId>`) and auth is header-based (no cookies), so it
works through a TLS-terminating proxy. The app sets `trust proxy` so
`X-Forwarded-*` are honored.

- Use `nginx.conf.example` (root). It terminates TLS and **must forward the
  WebSocket upgrade** (the `Upgrade`/`Connection` headers + the `map` block) and
  use long `proxy_read_timeout`/`proxy_send_timeout` for the long-lived sync
  socket.
- **Lock down port `1234`** so traffic only flows through nginx:
  - nginx on the **same host** → bind the published port to localhost
    (`"127.0.0.1:1234:1234"` in `docker-compose.yml`).
  - nginx on a **separate host** → keep `1234` published but restrict it in the
    app host's security group/firewall to nginx's IP only, and set
    `proxy_pass` to the app's private IP.

## How it works

- Each room is a Yjs document keyed by the room ID. The `y-websocket` provider
  syncs edits as CRDT updates (not raw text), so concurrent edits merge cleanly.
- The selected language is stored in a shared `Y.Map`, so changing it propagates
  to both editors instantly.
- Remote cursors/selections come from Yjs **awareness** (`y-codemirror.next`),
  colored per user.
- The server reads the room from the WebSocket URL path and refuses the 3rd
  connection by closing it with code `4001` before binding it to the document.
  The client detects `4001` and shows the "Session is full" screen.
