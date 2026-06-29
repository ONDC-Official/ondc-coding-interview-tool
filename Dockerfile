# syntax=docker/dockerfile:1

# ---------- Stage 1: build the React/Vite client ----------
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---------- Stage 2: build the Express/TS server ----------
FROM node:20-alpine AS server-build
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# ---------- Stage 3: lean production runtime ----------
FROM node:20-alpine AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=1234 \
    MAX_USERS_PER_ROOM=2 \
    CLIENT_DIST=/app/client/dist
WORKDIR /app/server

# Only production dependencies for the server.
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Compiled server + built client static assets.
COPY --from=server-build /app/server/dist ./dist
COPY --from=client-build /app/client/dist /app/client/dist

EXPOSE 1234
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:1234/healthz >/dev/null 2>&1 || exit 1

USER node
CMD ["node", "dist/index.js"]
