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
- Backend: **Node.js** — `y-websocket` server, 2-user cap, serves the frontend
- Frontend: **React + Vite**, dark theme

## Prerequisites

- Node.js 18+ (developed on Node 24)

## Install

```bash
npm install
```

## Run locally (development, with hot reload)

Starts the WebSocket backend on `:1234` and the Vite dev server on `:5173`
together:

```bash
npm run dev
```

Then open **http://localhost:5173** and click **Create new session**.

To test collaboration, open the resulting `/s/...` link in a second browser
window. Open it in a **third** window to see the "Session is full" rejection.

## Run locally (production build, single server)

Build the frontend, then start the Node server which serves it and handles
WebSocket sync on the same port:

```bash
npm run build
npm start
```

Then open **http://localhost:1234**.

## Configuration

- `PORT` — backend port (default `1234`), e.g. `PORT=3000 npm start`.
- `VITE_WS_URL` — WebSocket URL the frontend connects to. Set in
  `.env.development` for dev (`ws://localhost:1234`). Unset in a production
  build, so the client uses the same origin that served the page.

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
