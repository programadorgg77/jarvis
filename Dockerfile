FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY src ./src
COPY public ./public
RUN node -e "require('node:fs').cpSync('node_modules/@mediapipe/tasks-vision/wasm','public/mediapipe',{recursive:true})"
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production JARVIS_DEPLOY=1 JARVIS_ALLOW_WRITES=0 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY requirements-voice.txt ./
RUN python3 -m venv /app/.venv-voice \
    && /app/.venv-voice/bin/pip install --no-cache-dir -r requirements-voice.txt
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY bridge ./bridge
COPY scripts/neural-voice.py ./scripts/neural-voice.py
COPY LICENSE ./LICENSE
USER node
CMD ["node", "bridge/server.mjs"]
