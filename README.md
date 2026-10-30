# J.A.R.V.I.S.

A browser voice assistant with an Iron Man holographic interface. Say
**"Hey Jarvis"**, he wakes, listens, and does real things through your tools —
searches the web, generates images, drives your phone, reads your mail. The face
is a web page (React + Vite + Three.js + custom GLSL). The brain is Claude Code,
run headless as a library.

**The only subscription you need is Claude Code.** No API keys, no OpenAI
account, no cloud bill — the brain runs on your existing Claude Code login, and
the heavy work (the model itself) runs on Anthropic's servers, so even a low-end
laptop only has to draw the interface. **ElevenLabs is an optional add-on** that
gives JARVIS a much better voice and sharper hearing; without it he speaks and
listens through the browser's own speech, and everything still works.

---

## Requirements

**In one line:** a Claude Code subscription, plus two free things every computer
can have — Node.js and Chrome. That's the whole list.

- **Claude Code, installed and logged in** — this is the only account you need.
  Install it with the official method — `npm install -g @anthropic-ai/claude-code`,
  or the platform installer at <https://docs.claude.com/en/docs/claude-code> —
  then run `claude` once and complete login. The bridge reuses that login. **No
  API key**, and usage is billed to your existing Claude account.
- **Node.js 20 or newer** — free, one installer from <https://nodejs.org>. This
  is a Node web app, so it is the one unavoidable tool.
- **Google Chrome or Microsoft Edge**, in a **real browser window** — not an
  embedded preview pane. Preview panes (including the one inside editors and
  Claude Code) block microphone access, so the page loads and looks right but
  never hears you. JARVIS also needs WebGL, which these browsers provide.
- **Optional: an ElevenLabs API key** — a good add-on, not a requirement. It
  gives a better voice and sharper transcription; the free tier is plenty for a
  demo. Without it, everything runs on the browser's own speech.

Run `npm run setup` after cloning and it checks all of this for you, in plain
language.

---

## Quick start

First, install, then start it:

```bash
npm install
npm start          # runs the brain and the face together
```

Then open the URL it prints (http://localhost:5173) in **Chrome**, click **INICIAR JARVIS**, allow microphone access, and say **“Ei, Jarvis”**.

Prefer two terminals? Run them separately instead:

```bash
npm install
```

Terminal 1 — the brain:

```bash
npm run bridge
```

Terminal 2 — the face:

```bash
npm run dev
```

Then open the app in a **real Chrome or Edge window**:

```bash
open http://localhost:5173
```

Click **INICIAR JARVIS**, allow the microphone when asked, and say **"Ei, Jarvis"**.

> It has to be a real browser window. Embedded preview panes block the
> microphone, so JARVIS will look perfectly alive and simply never respond.

---

## How it works

JARVIS is two processes. The browser is the face and the voice; the bridge is
the brain and the hands.

```
  ┌─ browser (the face) ───────────────┐        ┌─ bridge (the brain) ─────────────┐
  │  "Ei, Jarvis" wake word             │        │  Node · bridge/server.mjs        │
  │  local VAD  →  speech to text      │   ws   │  Claude Agent SDK                │
  │  reactor UI (Three.js + GLSL)      │◄─────► │   = Claude Code, headless        │
  │  text to speech                    │  8787  │  spawns your MCP servers         │
  │  heads-up display                  │        │  permission gate (decideTool)    │
  └────────────────────────────────────┘        └──────────────────────────────────┘
```

Everything you see and hear happens in the browser. The bridge is a single Node
process (`bridge/server.mjs`) that runs the **Claude Agent SDK**
(`@anthropic-ai/claude-agent-sdk`) — this spawns the real `claude` CLI as a child
process, so **the brain literally is Claude Code, headless.** They talk over a
WebSocket (plus a few HTTP endpoints) on `ws://localhost:8787`.

**Why a bridge at all?** A browser tab cannot spawn the local stdio MCP servers —
`higgsfield`, `elevenlabs`, `android`, `playwright`, `exa`, `serper`, and the
rest. The bridge can. And because it is the Agent SDK, it authenticates off your
existing Claude Code login: no API key, billed to that same Claude account.

**The model.** `claude-opus-5` at effort `medium` by default. Override with the
`JARVIS_MODEL` and `JARVIS_EFFORT` environment variables. On startup the bridge
prints its choice, e.g. `[jarvis] model claude-opus-5 · effort medium`.

### The voice pipeline

The loop is designed so that nothing silently dies and barge-in feels natural.

- **Detection is local.** An energy-based voice-activity detector
  (`src/lib/vad.ts`) decides when you are speaking. It is instant, cannot quietly
  fail, and is what makes **barge-in** work — speak while JARVIS is talking and he
  stops.
- **Portuguese is the default language.** Browser speech recognition is set to
  Brazilian Portuguese (`pt-BR`), ElevenLabs Scribe is pinned to Portuguese,
  and JARVIS's system prompt asks for natural Brazilian Portuguese replies.
- **Transcription has two tiers, chosen automatically at boot.** The browser asks
  the bridge `/health` and picks the best available:
  - **ElevenLabs key present** → Scribe v2, via the bridge `/stt` endpoint.
  - **Nothing configured** → the browser's own `SpeechRecognition` (Chrome/Edge),
    guarded by a heartbeat so it recovers when Chrome throttles it.
- **Speaking** uses the **ElevenLabs voice when a key is present**, and the
  browser's `speechSynthesis` otherwise. If a cloud call fails it falls back to
  a Brazilian Portuguese system voice, and if the OS voice itself is broken it
  latches over to the cloud voice. The selected ElevenLabs voice ID is retained;
  it needs an ElevenLabs key to be used.

So it works with no keys and auto-upgrades when a key appears — there is no flag
to set. Capability detection lives in `src/lib/capabilities.ts`, which probes the
bridge's `GET /health` (returning `{ ok, tts, stt }`, both tracking the
ElevenLabs key) once at boot and picks the engines.

---

## What JARVIS can do

Beyond answering, JARVIS reaches every MCP server in your Claude Code
configuration, and can drive his own interface.

### Your tools

Every server in your `~/.claude.json` is handed to the SDK explicitly. Depending
on what you have installed, that is roughly:

- **Web & search** — `exa`, `serper`, `serpapi`
- **Images & video** — `higgsfield`, `openrouter-image`, `palmier-pro`
- **Voice** — `elevenlabs`
- **Your phone** — `android`
- **The browser** — `playwright`

A few things you can say:

- *"What's happening in AI this week?"*
- *"Generate an image of the Mark VII suit."*
- *"Take a screenshot of my phone."*
- *"Open my GitHub notifications."*

> **Note on account connectors.** Servers you added through your **claude.ai
> account** are not stored on disk, so the bridge cannot see them — it works from
> the servers in `~/.claude.json` (about 14), not the claude.ai ones.

### JARVIS controls the interface

He drives the UI through MCP tools the bridge exposes:

- `ui_theme` — accent, background, per-phase colours
- `ui_reactor` — colour, scale, intensity, spin, and style (`ring` | `sphere` | `wire`), visibility
- `ui_orbit` — put images in orbit around the reactor
- `ui_chrome` — show or hide rails, transcript, badges
- `ui_effect` — `glitch` | `pulse` | `scan` | `shake` | `flash`
- `ui_screen` — clear
- `ui_reset` — back to defaults

So *"make it red, hide the systems list, put that render in orbit"* is a spoken
command.

### Personal context and accounts

Open **MEU JARVIS** in the upper-right corner or press **P** to set a name,
preferred form of address, and personal context. Jarvis stores this profile in
the current browser's local storage. When **Use this context with my questions**
is enabled, those details are included with each question sent to Claude; turn
it off or clear the profile at any time. Clearing the local profile does not
remove details already sent in the current Claude conversation.

The console lists MCP servers available through the local bridge. Add account
servers with **user scope** in Claude Code (`claude mcp add ... --scope user`),
finish any sign-in flow, then restart the bridge. Jarvis reads the user-scoped
server configuration from `~/.claude.json` at startup. Only connect services
you want Jarvis to read. Actions that change or send data remain behind the
bridge's write permission gate. Connected services are queried when a question
needs them; JARVIS does not copy entire accounts into the local profile.

### Mission control demonstration

The dashboard shows example agenda items, priorities, sales, campaign metrics
for Meta Ads/UTMify and news modules before accounts are connected. Every
number and appointment is labelled as illustrative; live information will only
appear after its source is connected and queried.

### The heads-up display

JARVIS authors panels with a `display` tool against a fixed `.hud-*` design
system. The browser sanitises the markup (DOMPurify, a class allowlist and a
strict CSP) before rendering. Rich media works — images, `<video>`, and
YouTube/Vimeo embeds. Remote images and video are fetched **server-side** through
the bridge (`/img` and `/media`, both SSRF-guarded), so hotlink-blocked news
thumbnails still appear and the page never beacons your IP to a host the model
chose.

---

## Controls

| Key / phrase | Does |
|---|---|
| **"Ei, Jarvis"** or **"Hey Jarvis"** | Wake him |
| **Space** | Talk without the wake word |
| Just speak | Interrupt him mid-sentence (barge-in) |
| **V** | Cycle the browser voice |
| **P** | Open the personal context and connections console |
| **Escape** | Stand down |
| **D** | Live diagnostics panel |
| **T** | One-line audio self-test |

---

## The boot sequence

Power-up plays a four-beat Iron Man start-up (`src/ui/Boot.tsx`): an
"INITIATING SYSTEM" status bar with a segmented progress bar and boot log; then
concentric reticle rings resolving into "J.A.R.V.I.S"; then a suit schematic;
then the triangular arc reactor lighting up — with a start-up sound under it
(`public/audio/boot-music.mp3`).

---

## Configuration

Everything is optional in bridge mode. Frontend settings live in `.env.local`
(copy `.env.example`); bridge settings are environment variables.

### Bridge

| Variable | Default | Effect |
|---|---|---|
| `JARVIS_BRIDGE_PORT` | `8787` | Port for the WebSocket + HTTP endpoints |
| `JARVIS_MODEL` | `claude-opus-5` | Model to run |
| `JARVIS_EFFORT` | `medium` | Reasoning effort |
| `JARVIS_ALLOW_WRITES` | off | `1` allows effectful tools (see below) |
| `JARVIS_ALLOWED_ORIGINS` | local dev | Extra WebSocket origins to accept |
| `JARVIS_ALLOW_NO_ORIGIN` | off | Accept connections with no `Origin` header |
| `JARVIS_FILE_ROOTS` | — | Roots the `/file` endpoint may serve from |
| `JARVIS_VOICE_ID` | `wDsJlOXPqcvIUKdLXjDs` | ElevenLabs voice id |
| `ELEVENLABS_API_KEY` | — | Optional; enables the ElevenLabs voice + Scribe |

### Frontend (`.env.local`)

| Variable | Effect |
|---|---|
| `VITE_BACKEND` | `bridge` (default) or `direct` |
| `VITE_BRIDGE_URL` | Where to reach the bridge |
| `VITE_TTS_ENGINE` | `system` or `kokoro` |
| `VITE_KOKORO_VOICE` | Voice for the Kokoro engine |
| `VITE_USE_ELEVENLABS` | Force the ElevenLabs voice on |
| `VITE_ANTHROPIC_API_KEY` | Direct mode only |

### Adding an ElevenLabs key

You do not have to touch a flag. Either:

- Set `ELEVENLABS_API_KEY` on the bridge before starting it, **or**
- Add the key to your `elevenlabs` MCP server's env in `~/.claude.json` — the
  bridge reads it from there too.

Either way, `/health` starts reporting the capability, the browser picks it up on
the next boot, and both the voice and transcription upgrade automatically.

---

## Enabling actions

The tool gate starts **read-only**. Search, generation and lookups run freely;
anything effectful — send, tap, delete, install, pay — is denied. Voice is a poor
interface for a confirmation dialog, so the decision is made ahead of time in
`decideTool()` in `bridge/server.mjs`, not at the moment of use. The bridge sets
`settingSources: []`, which makes its own gate the only authority — filesystem
settings and any global `bypassPermissions` cannot override it.

To allow effectful tools (phone, browser driving, sending), run the bridge this
way instead:

```bash
npm run bridge:writes
```

> Read `decideTool()` before you do. *"Hey Jarvis, clean up my downloads folder"*
> means something rather different with writes enabled.

---

## Troubleshooting

### Voz em português e acompanhamento das consultas

O painel à direita mostra ações observáveis: integração consultada, período,
resultado da consulta e reprodução de voz. Clique em uma etapa para ver a fonte
e as datas. As etapas permanecem disponíveis depois da resposta. O olho volta
seu olhar para esse painel durante as consultas.

O faturamento é lido por `jarvis_sales.get_sales_summary`: o código resolve o
período no fuso do dashboard e converte os valores da UTMify de centavos para a
moeda informada. O resumo bruto da UTMify não fica disponível ao modelo.

Sem chave ElevenLabs, a instalação local pode usar a voz masculina brasileira
Antônio do serviço online Microsoft Edge, através de `edge-tts`. O texto falado
é enviado ao serviço de voz da Microsoft; exige internet. Para preparar em outra
máquina, com Python instalado, execute no PowerShell:

```powershell
python -m venv .venv-voice
.\.venv-voice\Scripts\python.exe -m pip install -r requirements-voice.txt
npm start
```

Se o serviço não responder, o Jarvis recorre à voz do sistema. Uma chave
ElevenLabs configurada mantém prioridade. Perguntas digitadas não são
interrompidas pelo áudio ambiente e retornam ao modo de espera ao terminar.

### Mercado global e notícias

O painel superior mostra USD, EUR e GBP em reais, e o real em dólares. As taxas
vêm da Frankfurter, com data de referência e variação sobre a referência
anterior. São taxas diárias, não preços de negociação em tempo real. Clique
em uma moeda para abrir o conversor; os cálculos entre BRL, USD, EUR e GBP são
feitos no código, usando taxas de uma mesma data.

O radar inferior recebe manchetes da Agência Brasil, BBC Brasil e G1 Tecnologia,
com editorias Geral, Economia, Tecnologia e Mundo. Use as setas, expanda a lista,
abra a fonte ou peça ao Jarvis um resumo. A conversa usa as ferramentas
`jarvis_world.get_exchange_rates`, `convert_currency` e `get_news`.

Não precisa de chave adicional. Os dados públicos passam pelo backend, com
cache de 10 minutos para câmbio e 5 minutos para notícias. As fontes são fixas;
conteúdo externo é tratado como dados. Se uma atualização falhar, um dado
anterior é identificado como sem nova confirmação. Nenhum valor de exemplo
substitui um resultado indisponível.

### Jev opcional

O classificador Jev pode ser configurado com `TYPESAFE_API_KEY` no ambiente do
backend, ou com `powershell -File scripts/setup-jev.ps1`. A configuração local
`jev.config.local` é ignorada pelo Git. Reinicie o servidor após configurar.
O endpoint `/health` informa se está configurado; uma falha ou limite de espera
mantém o fluxo normal da conversa. A criação da chave depende de créditos na
conta TypeSafe.

**I can't hear him, or he can't hear me.** Press **D** for the diagnostics panel
— it states plainly whether he is hearing you and whether he is producing sound.
Press **T** for a one-line audio self-test.

**No voice at all.** You must be in **Chrome or Edge**, in a **real browser
window** (not an embedded preview), and you must have **allowed the microphone**.

**Bridge not reachable.** Check that `npm run bridge` is still running in its
terminal, and that nothing else is holding port `8787`.

---

## Security

Para hospedar a mesma interface no Railway, use o `Dockerfile` e siga
[deploy/RAILWAY.md](deploy/RAILWAY.md). A versao hospedada exige usuario e senha;
as credenciais Claude e UTMify ficam nas variaveis do servico.

Para copiar para outro PC Windows, leia [LEIA-ME-PORTATIL.txt](LEIA-ME-PORTATIL.txt). Execute
`pwsh -NoProfile -File scripts/package-windows.ps1` para gerar um ZIP em
`output/entrega`, sem credenciais ou configurações pessoais. O ZIP inclui Node,
Python, voz neural, Claude Code e o painel compilado para Windows x64. O destinatário
extrai a pasta, conecta a própria conta em `Conectar Claude.cmd` e abre
`Iniciar Jarvis.cmd`. Nenhum serviço de hospedagem é necessário. Claude e as
integrações online usam internet e mantêm seus próprios requisitos de acesso.

All of this lives in `bridge/server.mjs`:

- The WebSocket accepts only local dev origins (add more with
  `JARVIS_ALLOWED_ORIGINS`).
- `/file`, `/img` and `/media` validate the scheme, confine to allowed roots,
  resolve the real path, and refuse private and loopback addresses (SSRF guard).
- The tool gate (`decideTool`) is default-deny for effectful MCP tools.
- A strict CSP in `index.html`; model-authored panel HTML is sanitised.

---

## Credits & licence

MIT.

The boot sound and any tracks in `public/audio/` ship with the project for the
demo. If you go on to monetise something built on this, clearing the rights to
that audio is your responsibility.
