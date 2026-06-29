# ONDC Coding Interview Tool

A minimal **real-time collaborative code editor** for one-on-one DSA coding
interviews, built for **ONDC** (Open Network for Digital Commerce). Two people
open the same secret link and edit a single shared file together — live,
conflict-free, with each other's cursor and selection visible.

## Features

- **Single shared file**, full-screen editor. No file tree, no tabs.
- **Syntax highlighting** with a language selector: Python, JavaScript, Java,
  C++. Switching language updates highlighting for **both** users in real time
  (the choice is part of the shared document).
- **Conflict-free collaborative editing** via [Yjs](https://yjs.dev) (a CRDT) —
  no full-document broadcasts, no lost keystrokes or cursor jumping when both
  type at once.
- **Remote cursors & selections** shown in each user's distinct color.
- **Secret room IDs** in the URL (e.g. `/s/Ab3xY7Qz...`, 16 random base62
  chars). Anyone with the link joins; without it the room can't be found.
- **Hard cap of 2 users per room, enforced on the server.** A third visitor is
  rejected with a clear "Session is full" screen and never joins the document.
- **Presence indicator** ("2/2 connected") plus connection status.
- **Landing page** with "Create new session"; **Copy link** button in-session.

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
├── deploy/            # pm2 ecosystem config used on the EC2
├── .github/workflows/ # CI/CD: deploy.yml
└── package.json       # root orchestrator scripts (uses workspaces' two projects)
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

Then open **http://localhost:5173** and click **Create new session**.

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

Frontend (`client/`) env vars (Vite):

- `VITE_WS_URL` — explicit WebSocket URL override (optional).
- `VITE_WS_PORT` — dev backend port (default `1234`). In dev the client derives
  the WS host from the page URL, so localhost **and** a LAN/remote IP both work.
  In a production build it uses the same origin that served the page.

Health check: `GET /healthz` returns `{ status, uptimeSeconds, rooms, connections }`.

## Deployment (GitHub Actions → EC2)

On push to `main`, `.github/workflows/deploy.yml` builds both projects, ships the
artifact to the workbench EC2, installs production deps, and (re)starts the app
with **pm2** (`deploy/ecosystem.config.cjs`). The app is served directly on port
`1234`.

Required repo secrets (Settings → Secrets and variables → Actions):

| Secret        | Value                              |
| ------------- | ---------------------------------- |
| `EC2_HOST`    | `13.233.69.163`                    |
| `EC2_USER`    | `ubuntu`                           |
| `EC2_SSH_KEY` | contents of the `.pem` private key |

`EC2_HOST` and `EC2_USER` are already set via CLI. **Add `EC2_SSH_KEY` manually**
(paste the full PEM), then re-run the workflow. Until it's set, CI builds but
skips the deploy step.

EC2 prerequisites: Node 18+ and pm2 installed; security-group **inbound TCP
`1234`** open. After deploy, the app is at **http://13.233.69.163:1234**.

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
