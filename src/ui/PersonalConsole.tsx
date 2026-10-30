import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import {
  clearPersonalContext,
  EMPTY_PERSONAL_CONTEXT,
  readPersonalContext,
  savePersonalContext,
  type PersonalContext,
} from '../lib/personalContext'

const knownConnectors: Record<string, string> = {
  gmail: 'Gmail',
  google_calendar: 'Google Calendar',
  google_drive: 'Google Drive',
  google_sheets: 'Google Sheets',
  google_contacts: 'Google Contacts',
  notion: 'Notion',
  github: 'GitHub',
  slack: 'Slack',
  spotify: 'Spotify',
  android: 'Android',
  playwright: 'Browser',
  jarvis_chrome: 'Chrome',
}

const priorityConnections = [
  { name: 'Gmail', aliases: ['gmail', 'googleworkspace', 'google_workspace'] },
  { name: 'Google Calendar', aliases: ['calendar', 'google_calendar', 'googleworkspace', 'google_workspace'] },
  { name: 'Google Drive', aliases: ['drive', 'google_drive', 'googleworkspace', 'google_workspace'] },
  { name: 'Android / WhatsApp', aliases: ['android', 'whatsapp', 'whatsapp_cloud'] },
  { name: 'Meta Ads', aliases: ['meta_ads', 'meta', 'facebook_ads', 'facebook'] },
  { name: 'UTMify', aliases: ['utmify', 'utmify_mcp'] },
]
const internalServers = new Set(['jarvis', 'jarvis_ui', 'jarvis_chrome', 'jarvis_eyes'])

function normaliseConnector(id: string): string {
  return id.toLowerCase().replace(/[.\s-]/g, '_')
}

function isPriorityConnectionActive(name: string, aliases: string[], connected: string[]): boolean {
  const id = normaliseConnector(name)
  const configured = connected.map(normaliseConnector)
  return configured.some((server) =>
    aliases.some((alias) => {
      const key = normaliseConnector(alias)
      return server === key || server.startsWith(`${key}_`) || server.endsWith(`_${key}`)
    }) || server === id,
  )
}

function connectorName(id: string): string {
  const normalised = id.toLowerCase().replace(/[.-]/g, '_')
  return knownConnectors[normalised] ?? id.replace(/[_-]/g, ' ')
}

export function PersonalConsole() {
  const connected = useStore((s) => s.connected)
  const externalConnected = connected.filter((id) => !internalServers.has(normaliseConnector(id)))
  const phase = useStore((s) => s.phase)
  const [open, setOpen] = useState(false)
  const [profile, setProfile] = useState<PersonalContext>(() => readPersonalContext())
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [commandCopied, setCommandCopied] = useState(false)
  const connectorsRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.key?.toLowerCase() !== 'p' || event.metaKey || event.ctrlKey || event.altKey) return
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return
      setOpen((value) => !value)
    }
    window.addEventListener('keydown', onKeyDown)
    const openConsole = () => setOpen(true)
    window.addEventListener('jarvis:open-profile', openConsole)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('jarvis:open-profile', openConsole)
    }
  }, [])

  const save = (event: FormEvent) => {
    event.preventDefault()
    try {
      savePersonalContext(profile)
      setSaved(true)
      setSaveError(false)
      window.setTimeout(() => setSaved(false), 1800)
    } catch {
      setSaved(false)
      setSaveError(true)
    }
  }

  const clear = () => {
    clearPersonalContext()
    setProfile(EMPTY_PERSONAL_CONTEXT)
    setSaved(false)
    setSaveError(false)
  }

  const update = <K extends keyof PersonalContext>(key: K, value: PersonalContext[K]) =>
    setProfile((current) => ({ ...current, [key]: value }))

  const copySetupCommand = async () => {
    try {
      await navigator.clipboard.writeText('claude setup-token')
      setCommandCopied(true)
      window.setTimeout(() => setCommandCopied(false), 2200)
    } catch {
      setCommandCopied(false)
    }
  }

  const openConnections = () => connectorsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <>
      <button
        className="personal-trigger"
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Configurar Claude Cloud e integrações; ${externalConnected.length} servidores conectados`}
      >
        <span className="personal-trigger-mark" aria-hidden="true">C</span>
        <span className="personal-trigger-label">Conectar Cloud</span>
        <span className="personal-trigger-count" aria-label={`${externalConnected.length} conectados`}>
          {String(externalConnected.length).padStart(2, '0')}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="personal-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setOpen(false)
            }}
          >
            <motion.aside
              className="personal-console"
              role="dialog"
              aria-modal="true"
              aria-labelledby="personal-title"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.stopPropagation()
                  setOpen(false)
                  return
                }
                if (event.key === 'Tab') {
                  const items = event.currentTarget.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), input:not([disabled]), textarea:not([disabled])',
                  )
                  const first = items[0]
                  const last = items[items.length - 1]
                  if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault()
                    last?.focus()
                  } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault()
                    first?.focus()
                  }
                }
              }}
              initial={{ opacity: 0, x: 36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            >
              <header className="personal-head">
                <div>
                  <div className="personal-eyebrow"><span /> CONFIGURAÇÕES / CONEXÕES</div>
                  <h1 id="personal-title">Configurar<br /><em>o Jarvis.</em></h1>
                </div>
                <button className="personal-close" onClick={() => setOpen(false)} aria-label="Fechar console pessoal">×</button>
              </header>

              <section className="personal-cloud-setup" aria-labelledby="cloud-setup-title">
                <div className="personal-cloud-setup-label"><span /> IA / CLAUDE CLOUD</div>
                <h2 id="cloud-setup-title">Conectar a IA do Jarvis</h2>
                <p>Conecte sua conta Claude para o Jarvis responder usando sua assinatura.</p>
                <div className="personal-cloud-actions">
                  <a className="personal-cloud-primary" href="https://dashboard.render.com/web/srv-dbi1h8ifngtc73c115ig/env" target="_blank" rel="noreferrer">
                    Abrir conexão no Render <span aria-hidden="true">↗</span>
                  </a>
                  <button className="personal-cloud-copy" type="button" onClick={() => void copySetupCommand()}>
                    {commandCopied ? 'Comando copiado' : 'Copiar comando'} <code>claude setup-token</code>
                  </button>
                </div>
                <ol className="personal-cloud-steps">
                  <li>Execute o comando copiado no Claude Code e entre na sua conta.</li>
                  <li>No Render, crie <code>CLAUDE_CODE_OAUTH_TOKEN</code> com o token gerado e salve.</li>
                </ol>
                <nav className="personal-cloud-links" aria-label="Atalhos da conexão Claude">
                  <a href="https://code.claude.com/docs/en/authentication#generate-a-long-lived-token" target="_blank" rel="noreferrer">Ajuda para gerar o token <span aria-hidden="true">↗</span></a>
                  <button type="button" onClick={openConnections}>Ver integrações de e-mail, agenda e dados <span aria-hidden="true">↓</span></button>
                </nav>
              </section>

              <div className="personal-intro">
                <span className="personal-index">PERFIL PESSOAL</span>
                <p>Personalize o contexto que o Jarvis usa nas respostas.</p>
              </div>

              <form className="personal-form" onSubmit={save}>
                <label className="personal-field">
                  <span>Seu nome</span>
                  <input
                    value={profile.name}
                    onChange={(event) => update('name', event.target.value)}
                    placeholder="Como Jarvis deve chamar você"
                    maxLength={80}
                    autoComplete="name"
                  />
                </label>
                <label className="personal-field">
                  <span>Como prefere ser tratado?</span>
                  <input
                    value={profile.address}
                    onChange={(event) => update('address', event.target.value)}
                    placeholder="Seu nome, senhor, ou outro tratamento"
                    maxLength={80}
                  />
                </label>
                <label className="personal-field">
                  <span>O que ele deve ter em mente?</span>
                  <textarea
                    value={profile.about}
                    onChange={(event) => update('about', event.target.value)}
                    placeholder={'Prioridades, rotina, projetos, preferências…\nInclua só o que você quer que Jarvis lembre.'}
                    maxLength={4000}
                    rows={5}
                  />
                  <small>{profile.about.length} / 4000</small>
                </label>

                <label className="personal-consent">
                  <input
                    type="checkbox"
                    checked={profile.includeWithQuestions}
                    onChange={(event) => update('includeWithQuestions', event.target.checked)}
                  />
                  <span className="personal-switch" aria-hidden="true" />
                  <span><b>Usar este contexto nas minhas perguntas</b><small>Enviado ao Claude junto com cada pergunta.</small></span>
                </label>

                <div className="personal-actions">
                  <button className="personal-save" type="submit">{saved ? 'PERFIL SALVO' : 'SALVAR PERFIL'} <span>↗</span></button>
                  <button className="personal-clear" type="button" onClick={clear}>Apagar memória</button>
                </div>
                {saveError && <p className="personal-save-error" role="alert">Não foi possível salvar neste navegador.</p>}
              </form>

              <section className="personal-connectors" aria-labelledby="connector-title" ref={connectorsRef}>
                <div className="personal-section-head">
                  <div>
                    <span className="personal-index">INTEGRAÇÕES CLOUD</span>
                    <h2 id="connector-title">Conexões em nuvem</h2>
                  </div>
                  <span className={`personal-live ${connected.length ? 'is-live' : ''}`}>
                    {externalConnected.length ? `${externalConnected.length} SERVIDORES` : phase === 'offline' ? 'AGUARDANDO' : 'CONFIGURAR'}
                  </span>
                </div>
                <ul className="personal-connector-list">
                  {priorityConnections.map((connection) => {
                    const active = isPriorityConnectionActive(connection.name, connection.aliases, externalConnected)
                    return (
                      <li key={connection.name} className={active ? 'connector-active' : 'connector-pending'}>
                        <span className="personal-connector-dot" />
                        <span>{connection.name}</span>
                        <small>{active ? 'CONECTADO' : 'CONFIGURAR'}</small>
                      </li>
                    )
                  })}
                </ul>
                {externalConnected.length ? (
                  <>
                    {externalConnected.some((id) => !priorityConnections.some((connection) => isPriorityConnectionActive(connection.name, connection.aliases, [id]))) && (
                      <div className="personal-extra-links">
                        <span className="personal-index">OUTROS SERVIDORES MCP</span>
                        <p>{externalConnected.filter((id) => !priorityConnections.some((connection) => isPriorityConnectionActive(connection.name, connection.aliases, [id]))).map(connectorName).join(' · ')}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="personal-empty-connectors">Cadastre os serviços como MCP no escopo de usuário do Claude Code (<code>--scope user</code>), autentique e reinicie a ponte. Jarvis detecta as conexões na próxima inicialização.</p>
                )}
                <nav className="personal-doc-links" aria-label="Guias de conexão">
                  <a href="https://code.claude.com/docs/en/mcp" target="_blank" rel="noreferrer">Guia MCP <span>↗</span></a>
                  <a href="https://developers.google.com/workspace/guides/configure-mcp-servers" target="_blank" rel="noreferrer">Google Workspace <span>↗</span></a>
                  <a href="https://utmify.com.br/" target="_blank" rel="noreferrer">UTMify <span>↗</span></a>
                  <a href="https://developers.facebook.com/docs/marketing-api/" target="_blank" rel="noreferrer">Meta Ads <span>↗</span></a>
                </nav>
                <div className="personal-footnote">
                  O perfil salvo fica neste navegador. Ativado, ele acompanha as perguntas enviadas ao Claude; apagar o perfil não remove mensagens anteriores. Jarvis consulta serviços conectados quando a pergunta pede, sem importar tudo para o perfil.
                </div>
              </section>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
