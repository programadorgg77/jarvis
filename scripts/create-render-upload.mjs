import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Browser uploads keep this deployment independent of the CLI's GitHub account.
// Archive only the audited source allowlist, never the staging .git directory.
const source = readFileSync('output/render/current-stage.local', 'utf8').trim()
const output = resolve('output/render/repo-upload')
mkdirSync(output, { recursive: true })
const bundle = join(output, 'jarvis-source.tar.gz')
const files = ['package.json', 'package-lock.json', 'index.html', 'vite.config.ts',
  'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'requirements-voice.txt',
  'LICENSE', 'src', 'public', 'bridge', 'scripts']
execFileSync('tar.exe', ['-czf', bundle, '-C', source, ...files])
const entries = execFileSync('tar.exe', ['-tzf', bundle], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean)
if (entries.some((path) => /(^|\/)\.|\.local$|\.log$/.test(path) || path.startsWith('/') || path.includes('..'))) {
  throw new Error('Unexpected file in source archive')
}
const hash = createHash('sha256').update(readFileSync(bundle)).digest('hex')
writeFileSync(join(output, 'SOURCE.sha256'), `${hash}  jarvis-source.tar.gz\n`)
writeFileSync(join(output, 'Dockerfile'), `FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY jarvis-source.tar.gz SOURCE.sha256 ./
RUN sha256sum -c SOURCE.sha256 && tar -xzf jarvis-source.tar.gz
RUN npm ci --no-audit --no-fund
RUN node -e "require('node:fs').cpSync('node_modules/@mediapipe/tasks-vision/wasm','public/mediapipe',{recursive:true})"
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production JARVIS_DEPLOY=1 JARVIS_ALLOW_WRITES=0 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates \\
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/requirements-voice.txt ./
RUN python3 -m venv /app/.venv-voice \\
    && /app/.venv-voice/bin/pip install --no-cache-dir -r requirements-voice.txt
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/bridge ./bridge
COPY --from=build /app/scripts/neural-voice.py ./scripts/neural-voice.py
COPY --from=build /app/LICENSE ./LICENSE
# Retain the Origin header on browser login form submissions.
RUN sed -i "s/'referrer-policy', 'no-referrer'/'referrer-policy', 'same-origin'/" bridge/server.mjs
USER node
CMD ["node", "bridge/server.mjs"]
`)
copyFileSync(join(source, 'LICENSE'), join(output, 'LICENSE'))
writeFileSync(join(output, 'README.md'), `# Jarvis - Render Free\n\nPublicacao privada do Jarvis. O arquivo jarvis-source.tar.gz contem o codigo fonte auditado do painel e backend. O Dockerfile verifica SOURCE.sha256, extrai os fontes e compila o aplicativo. Nao contem credenciais ou historico do autor.\n\nNo Render selecione Docker, plano Free, healthcheck /ready. Configure JARVIS_ACCESS_USER e JARVIS_ACCESS_PASSWORD. Para a IA responder, configure CLAUDE_CODE_OAUTH_TOKEN da conta do proprietario. UTMIFY_MCP_URL conecta as vendas; credenciais sao variaveis de runtime, nunca arquivos do repositorio. A origem HTTPS e detectada automaticamente no Render.\n\n512 MB de RAM: funcionamento completo com Claude deve ser testado nessa instancia. O servico gratuito dorme apos 15 minutos sem uso. Nao alterar para plano pago sem autorizacao.\n`)
console.log(`Browser upload prepared: ${entries.length} source entries, SHA-256 verified in Docker build`)
console.log(output)
