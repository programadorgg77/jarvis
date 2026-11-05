import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useStore } from '../store'
import { Eye } from '../scene/Eye'
import { PersonalConsole } from './PersonalConsole'
import { CommandIcon } from './CommandIcon'
import { NeuralProcess } from './NeuralProcess'
import { ProductOffice } from './ProductOffice'
import { WorldRadar } from './WorldRadar'
import { NeuralField } from '../scene/NeuralField'
import { OpticReticle, OpticTelemetry } from './OpticTelemetry'
import { useSystemPulse, type SystemPulse } from '../lib/useSystemPulse'

export type AssistantActions = { onStart: () => void; onAsk: (text: string) => void; onTalk: () => void; onStop: () => void }

const internal = new Set(['jarvis', 'jarvis_ui', 'jarvis_chrome', 'jarvis_eyes', 'jarvis_sales', 'jarvis_world'])
const normalise = (id: string) => id.toLowerCase().replace(/[.\s-]/g, '_')
const available = (ids: string[], aliases: string[]) => ids.some((id) => aliases.some((alias) => normalise(id) === alias || normalise(id).startsWith(`${alias}_`) || normalise(id).endsWith(`_${alias}`)))
const profile = () => window.dispatchEvent(new Event('jarvis:open-profile'))
const formatMoney = (value: number | null, currency = 'BRL') => value === null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value)
const phaseText = { offline: 'AGUARDANDO ATIVAÇÃO', boot: 'INICIALIZANDO VOZ', dormant: 'ESCUTA EM ESPERA', waking: 'PRESENÇA DETECTADA', listening: 'OUVINDO', thinking: 'PROCESSANDO', tooling: 'CONSULTANDO SISTEMAS', speaking: 'TRANSMITINDO RESPOSTA' }

function Spectrum() {
  const level = useStore((s) => s.level)
  const phase = useStore((s) => s.phase)
  return <div className={`ocular-spectrum ${phase === 'speaking' ? 'is-output' : ''}`} aria-label={`Nível de áudio: ${Math.round(level * 100)}%`}>{Array.from({ length: 42 }, (_, i) => <i key={i} style={{ height: `${2 + level * 34 * (.3 + Math.abs(Math.sin(i * 1.78)) * .7)}px` }} />)}</div>
}

function Operations({ onAsk, busy, pulse }: { onAsk: (text: string) => void; busy: boolean; pulse: SystemPulse }) {
  const [period, setPeriod] = useState('today')
  const snapshot = useStore((s) => s.businessSnapshot)
  const connected = useStore((s) => s.connected)
  const phase = useStore((s) => s.phase)
  const calendar = available(connected, ['calendar', 'google_calendar', 'google_workspace', 'googleworkspace'])
  const series = snapshot?.series ?? []
  const max = Math.max(...series.map((s) => s.value), 1)
  const points = series.map((s, i) => `${i * 250 / Math.max(1, series.length - 1)},${45 - s.value / max * 40}`).join(' ')
  const periods = [{ id: 'today', name: 'DIA', query: 'de hoje' }, { id: 'week', name: 'SEM', query: 'dos últimos sete dias' }, { id: 'month', name: 'MÊS', query: 'deste mês' }, { id: 'year', name: 'ANO', query: 'deste ano' }]
  const confirmedPeriod = snapshot ? ({ today: 'today', yesterday: 'today', last_7_days: 'week', this_month: 'month', last_month: 'month', custom: '' }[snapshot.queryPeriod ?? 'custom']) : period
  const queryFinance = (id = period) => onAsk(`Consulte a UTMify e atualize os indicadores do painel e do telão do escritório com faturamento, lucro, investimento, pedidos aprovados e ROAS ${periods.find((item) => item.id === id)?.query ?? 'de hoje'}. Use dados reais e informe o período e a moeda da fonte. Para lucro use o valor da fonte, sem estimar faturamento menos gastos; deixe indisponível se não for retornado.`)
  return <>
    <section className="reference-card ocular-telemetry"><div className="ocular-panel-heading"><span><i className="reference-square"/>01 / TELEMETRIA</span><span className={`telemetry-live ${pulse.microphone ? 'is-online' : ''}`}><i />{pulse.microphone ? 'ATIVO' : 'EM ESPERA'}</span></div>
    <div className="ocular-audio-label"><span>{phase === 'speaking' ? 'SAÍDA DE VOZ' : 'ENTRADA DE VOZ'}</span><span>PT–BR</span></div><Spectrum />
    <div className="ocular-source-line"><span>CANAL OPERACIONAL</span><b className={pulse.online ? 'source-online' : ''}>{pulse.online ? 'ONLINE' : 'EM ESPERA'}</b></div><div className="ocular-latency"><span>LATÊNCIA</span><b>{pulse.latency !== null ? `${pulse.latency} ms` : '—'}</b></div></section>
    <section className={`reference-card ocular-finance ${snapshot ? 'has-snapshot' : 'is-empty'}`} aria-labelledby="ocular-finance-title"><div className="ocular-section-label"><CommandIcon name="trend" size={17} /><h2 id="ocular-finance-title">Faturamento</h2><div className="finance-periods" aria-label="Período do faturamento">{periods.map((item) => <button key={item.id} disabled={busy} aria-pressed={confirmedPeriod === item.id} onClick={() => { setPeriod(item.id); queryFinance(item.id) }}>{item.name}</button>)}</div></div>{snapshot && <strong className="ocular-revenue">{formatMoney(snapshot.revenue, snapshot.currency)}</strong>}<span className="ocular-period">{snapshot?.period ?? 'Nenhum período consultado'}</span>
      <div className="ocular-revenue-chart"><svg viewBox="0 0 250 50" preserveAspectRatio="none" role="img" aria-label={series.length > 1 ? 'Evolução da receita consultada' : 'Aguardando série de receita'}>{series.length > 1 ? <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.4" vectorEffect="non-scaling-stroke" /> : <><path d="M0 39H250 M0 13H250" stroke="currentColor" strokeOpacity=".12" strokeDasharray="2 5"/><path d="M0 39H250" stroke="currentColor" strokeOpacity=".3"/></>}</svg></div>
      <ProductOffice onRefresh={() => queryFinance()} busy={busy} />
      <dl className="ocular-metrics"><div><dt><CommandIcon name="receipt" size={16}/>Investimento</dt><dd>{snapshot ? formatMoney(snapshot.spend, snapshot.currency) : '—'}</dd></div><div><dt><CommandIcon name="orders" size={16}/>Pedidos aprovados</dt><dd>{snapshot?.orders?.toLocaleString('pt-BR') ?? '—'}</dd></div><div><dt><CommandIcon name="people" size={16}/>ROAS</dt><dd>{snapshot?.roas != null ? `${snapshot.roas.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}×` : '—'}</dd></div></dl>
      <button className="ocular-query" disabled={busy} onClick={() => queryFinance()}><CommandIcon name="target" size={15}/><span>{snapshot ? 'Atualizar indicadores' : 'Consultar meu faturamento'}</span><CommandIcon name="arrow-up" size={13} /></button>
      <span className="ocular-data-source">{snapshot ? `${snapshot.source} · última consulta` : 'Os indicadores recebem apenas dados consultados.'}</span>
    </section>
    <section className="reference-card ocular-agenda"><div className="ocular-section-label"><CommandIcon name="calendar" size={17} /><h2>Agenda</h2><CommandIcon name="calendar" size={13} /></div><p>{calendar ? 'Consulte seus próximos compromissos.' : 'Calendário ainda não conectado.'}</p><button disabled={busy} onClick={calendar ? () => onAsk('Quais são meus próximos compromissos na agenda?') : profile}><CommandIcon name="target" size={14}/><span>{calendar ? 'Ver meu dia' : 'Configurar agenda'}</span><span>›</span></button></section>
    <section className="reference-card ocular-radar"><div className="ocular-section-label"><CommandIcon name="target" size={17}/><h2>Radar</h2><CommandIcon name="radar" size={14} /></div><button disabled={busy} onClick={() => onAsk('Pesquise as principais notícias de tecnologia e negócios de hoje e me dê um resumo com as datas.')}><CommandIcon name="orders" size={14}/><span>Notícias de hoje</span><span>›</span></button><button disabled={busy} onClick={() => onAsk('Consulte a UTMify e analise as campanhas com melhor e pior retorno neste mês.')}><CommandIcon name="people" size={14}/><span>Análise de campanhas</span><span>›</span></button></section>
  </>
}

function Systems() {
  const connected = useStore((s) => s.connected)
  const voice = useStore((s) => s.voice)
  const services = [
    { name: 'Síntese de voz', status: voice ? voice : 'EM ESPERA', on: Boolean(voice), tone: 'mint' },
    { name: 'UTMify', status: 'DADOS COMERCIAIS', on: available(connected, ['utmify', 'utmify_mcp']), tone: 'blue' },
    { name: 'Meta Ads', status: 'CAMPANHAS', on: available(connected, ['meta', 'meta_ads', 'facebook', 'facebook_ads']), tone: 'violet' },
    { name: 'Google Calendar', status: 'AGENDA', on: available(connected, ['calendar', 'google_calendar', 'googleworkspace', 'google_workspace']), tone: 'cyan' },
    { name: 'Gmail', status: 'MENSAGENS', on: available(connected, ['gmail', 'googleworkspace', 'google_workspace']), tone: 'rose' },
  ]
  const extras = connected.filter((id) => !internal.has(normalise(id)) && !available([id], ['utmify', 'utmify_mcp', 'meta', 'meta_ads', 'facebook', 'facebook_ads', 'calendar', 'google_calendar', 'gmail', 'googleworkspace', 'google_workspace'])).slice(0, 4)
  return <section className="ocular-systems"><div className="ocular-panel-heading"><span>02 / SISTEMAS</span><button onClick={profile} aria-label="Gerenciar conexões"><CommandIcon name="link" size={13} /></button></div><div className="ocular-system-list">{services.map((service) => <button key={service.name} data-tone={service.tone} className={service.on ? 'is-available' : ''} onClick={profile}><i /><span>{service.name}</span><small>{service.on ? service.status : service.name === 'Síntese de voz' ? 'EM ESPERA' : 'NÃO CONECTADO'}</small></button>)}{extras.map((id, i) => <button key={id} data-tone={['blue','violet','rose','mint'][i]} className="is-available" onClick={profile}><i /><span>{id.replace(/[_-]/g,' ')}</span><small>DISPONÍVEL</small></button>)}</div></section>
}

function Conversation() {
  const turns = useStore((s) => s.turns)
  const caption = useStore((s) => s.caption)
  const activeTool = useStore((s) => s.activeTool)
  const ui = useStore((s) => s.ui)
  const scroll = useRef<HTMLDivElement>(null)
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight }, [turns, caption, activeTool])
  return <section className="ocular-conversation"><div className="ocular-panel-heading"><span>03 / FLUXO DE CONVERSA</span><span className="ocular-turn-count">{String(turns.filter((t) => t.role === 'user').length).padStart(2,'0')}</span></div><div className="ocular-conversation-scroll" ref={scroll} role="log" aria-label="Conversa com o Jarvis" aria-live="polite">{ui.chrome.transcript && turns.slice(-10).map((turn) => <article className={`ocular-message is-${turn.role}`} key={turn.id}><span>{turn.role === 'user' ? 'VOCÊ' : 'JARVIS'}<i /></span><p>{turn.text || 'Preparando resposta…'}</p></article>)}{!turns.length && <div className="ocular-conversation-empty"><span className="ocular-empty-mark">J.</span><p>Canal aberto.<br />O que precisa saber?</p></div>}{caption && <p className="ocular-partial">{caption}<i /></p>}{activeTool && ui.chrome.toolBadge && <div className="ocular-current-tool"><span className="ocular-loader" />{activeTool.replace(/^mcp__.*?__/, '').replace(/[_-]/g,' ')}</div>}</div></section>
}

export function OcularInterface({ onStart, onTalk, onStop, onAsk }: AssistantActions) {
  const godEyeActive = useStore((s) => s.godEyeActive)
  const pulse = useSystemPulse()
  const phase = useStore((s) => s.phase)
  const error = useStore((s) => s.error)
  const connected = useStore((s) => s.connected)
  const hasTurns = useStore((s) => s.turns.length > 0)
  const [keepPanels, setKeepPanels] = useState(true)
  const active = keepPanels || !['offline', 'boot', 'dormant'].includes(phase)
  const busy = ['thinking','tooling','speaking'].includes(phase)
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState(false)
  const [time, setTime] = useState(() => new Date())
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { const id = window.setInterval(() => setTime(new Date()), 1000); return () => clearInterval(id) }, [])
  useEffect(() => { if (typing) input.current?.focus() }, [typing])
  useEffect(() => { if (phase === 'thinking' || phase === 'listening') setKeepPanels(true) }, [phase])
  const submit = (e: FormEvent) => { e.preventDefault(); if (!draft.trim() || phase === 'boot') return; onAsk(draft.trim()); setDraft(''); setTyping(false) }
  const count = connected.filter((id) => !internal.has(normalise(id))).length
  return <main className={`ocular-interface has-world neural-shell reference-shell ${active ? 'ocular-is-active' : 'ocular-is-idle'} ${busy ? 'neural-is-busy' : ''} ${pulse.microphone ? 'has-live-microphone' : ''} phase-${phase}`} aria-label="Interface visual do Jarvis">
    {!godEyeActive && <NeuralField />}
    {!godEyeActive && <Eye />}
    <OpticReticle />
    <OpticTelemetry pulse={pulse}/>
    <WorldRadar onAsk={onAsk} busy={busy} />
    <header className="ocular-header"><div className="ocular-header-left"><span className={`ocular-presence-dot ${pulse.online ? 'is-online' : ''}`} /><span>{pulse.online ? 'SISTEMA ONLINE' : pulse.online === false ? 'SISTEMA OFFLINE' : 'CONECTANDO'}<small>{active ? 'INTERFACE ATIVA' : 'EM ESPERA'}</small></span></div><div className="ocular-wordmark">J.A.R.V.I.S.<span>PERSONAL INTELLIGENCE</span></div><div className="ocular-header-right"><div className="reference-clock"><time>{time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time><small>{time.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}</small></div><PersonalConsole /></div></header>
    <aside className="ocular-panel ocular-panel-left" aria-label="Dados da operação" aria-hidden={!active} inert={!active}><Operations onAsk={onAsk} busy={phase === 'boot' || busy} pulse={pulse}/></aside>
    <div className="ocular-eye-label" aria-live="polite"><span className="ocular-eye-rule" /><span>{active ? phaseText[phase] : ''}</span><span className="ocular-eye-rule" /></div>
    {active && <div className="neural-eye-caption" aria-hidden="true"><span className="neural-caption-bracket"/><span>J.A.R.V.I.S.<small>{phaseText[phase]}</small></span><span className="neural-caption-bracket"/></div>}
    <aside className="ocular-panel ocular-panel-right reference-card" aria-label="Sistemas e conversa" aria-hidden={!active} inert={!active}><NeuralProcess /><details className="ocular-connections"><summary><span><CommandIcon name="diamond" size={11}/>Conexões disponíveis</span><span>›</span></summary><Systems /></details><Conversation /></aside>
    <div className={`ocular-command ${typing ? 'is-typing' : ''}`}>
      {(active || typing) && <form onSubmit={submit} className="ocular-command-form">
        <button className={`ocular-input-mic ${busy ? 'can-stop' : ''}`} type="button" disabled={phase === 'boot'} onClick={phase === 'offline' ? onStart : busy ? onStop : onTalk} aria-label={phase === 'offline' ? 'Ativar microfone e Jarvis' : busy ? 'Interromper resposta' : 'Falar com Jarvis'}><CommandIcon name={busy ? 'stop' : 'mic'} size={18}/></button>
        <input ref={input} value={draft} onFocus={() => setTyping(true)} onChange={(e) => setDraft(e.target.value)} maxLength={4000} placeholder={phase === 'boot' ? 'Preparando áudio…' : 'Pergunte ao Jarvis…'} aria-label="Digite sua pergunta ao Jarvis" disabled={phase === 'boot'} />
        <button disabled={!draft.trim() || phase === 'boot'} aria-label="Enviar pergunta" type="submit"><CommandIcon name="send" size={15} /></button>
      </form>}
      <div className="ocular-command-controls"><button className={`ocular-mic ${busy ? 'can-stop' : ''}`} disabled={phase === 'boot'} onClick={phase === 'offline' ? onStart : busy ? onStop : onTalk} aria-label={phase === 'offline' ? 'Ativar microfone e Jarvis' : busy ? 'Interromper resposta' : 'Falar com Jarvis'}><CommandIcon name={busy ? 'stop' : 'mic'} size={16} /></button><span>{phase === 'offline' ? 'CLIQUE PARA ATIVAR O JARVIS' : phase === 'boot' ? 'PREPARANDO SUA SESSÃO' : busy ? 'ESC PARA INTERROMPER' : phase === 'dormant' ? 'DIGA “EI, JARVIS”' : active ? 'ESTOU OUVINDO' : 'DIGA “EI, JARVIS”'}</span>{!active && <button className="ocular-type-toggle" onClick={() => setTyping(!typing)}>{typing ? 'Fechar' : 'Digitar'}<span>↗</span></button>}</div>
    </div>
    {error && <div className="ocular-error" role="alert"><span>{error}</span><button onClick={() => useStore.getState().setError(null)} aria-label="Fechar aviso">×</button></div>}
    <footer className="ocular-footer"><span>J / 01<span className="ocular-footer-divider">/</span>{active ? `${String(count).padStart(2,'0')} FONTES DISPONÍVEIS` : 'VOICE INTERFACE'}</span>{hasTurns && phase === 'dormant' && <button onClick={() => setKeepPanels(!keepPanels)}>{keepPanels ? 'Recolher painéis' : 'Mostrar última conversa'}</button>}<span>PT-BR<span className="ocular-footer-divider">/</span>{time.toLocaleDateString('pt-BR')}</span></footer>
  </main>
}
