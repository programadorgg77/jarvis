import { useEffect, useState } from 'react'
import { useStore, type Activity } from '../store'
import { CommandIcon, type IconName } from './CommandIcon'

const stages = [
  { id: 'analysis', label: 'ENTENDER', kinds: ['analysis'], icon: 'diamond' },
  { id: 'sources', label: 'CONSULTAR', kinds: ['data', 'search', 'browser'], icon: 'search' },
  { id: 'response', label: 'RESPONDER', kinds: ['response'], icon: 'activity' },
  { id: 'voice', label: 'FALAR', kinds: ['voice'], icon: 'mic' },
]
const statusLabel = { running: 'EM CURSO', done: 'CONCLUÍDO', error: 'SEM RETORNO', cancelled: 'INTERROMPIDO' }
const label = (item: Activity) => item.detail === 'ToolSearch' ? 'Localizando a integração' : item.label

export function NeuralProcess() {
  const activities = useStore((s) => s.activities)
  const [selected, setSelected] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [now, setNow] = useState(Date.now())
  const running = activities.some((item) => item.status === 'running')
  const current = [...activities].reverse().find((item) => item.status === 'running') ?? activities.at(-1)
  const currentStage = stages.find((stage) => current && stage.kinds.includes(current.kind))?.id ?? 'analysis'
  const activeStage = selected ?? currentStage
  const visible = activities.filter((item) => expanded || stages.find((stage) => stage.id === activeStage)?.kinds.includes(item.kind))
  const finished = activities.filter((item) => item.status === 'done').length
  const turnStartedAt = activities[0]?.startedAt
  const headline = !activities.length ? 'Resposta em tempo real' : running && current ? label(current) : activities.some((item) => item.status === 'error') ? 'Retorno com pendências' : activities.some((item) => item.status === 'cancelled') ? 'Consulta interrompida' : 'Resposta entregue'
  useEffect(() => {
    if (!running) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [running])
  useEffect(() => { setSelected(null); setExpanded(false) }, [turnStartedAt])
  return <section className={`neural-process ${running ? 'is-processing' : ''}`} aria-label="Fluxo visual das ações do Jarvis">
    <div className="neural-process-head"><span><i />{running ? 'CONSULTA EM CURSO' : 'REGISTRO DA CONSULTA'}</span><span>{finished}/{activities.length} AÇÕES</span></div>
    <div className="neural-process-title" role="status">{headline}</div>
    <div className="neural-constellation">
      <svg viewBox="0 0 360 190" aria-hidden="true"><defs><linearGradient id="neural-line"><stop stopColor="#62dcff" stopOpacity=".1"/><stop offset=".5" stopColor="#a6efff"/><stop offset="1" stopColor="#62dcff" stopOpacity=".1"/></linearGradient></defs><ellipse cx="180" cy="95" rx="126" ry="63"/><path className="neural-connection" d="M48 95 180 29 312 95 180 161Z"/><path d="M48 95H312 M180 29V161"/><circle className="neural-core-orbit" cx="180" cy="95" r="33"/><circle cx="180" cy="95" r="26"/><path className="neural-core-cross" d="M180 54v12 M180 124v12 M139 95h12 M209 95h12"/></svg>
      <div className="neural-process-core"><span>J.</span><small>{running ? 'ATIVO' : 'REGISTRO'}</small></div>
      {stages.map((stage) => {
        const events = activities.filter((item) => stage.kinds.includes(item.kind))
        const state = events.some((item) => item.status === 'running') ? 'running' : events.some((item) => item.status === 'error') ? 'error' : events.some((item) => item.status === 'cancelled') ? 'cancelled' : events.length ? 'done' : 'waiting'
        return <button key={stage.id} className={`neural-node node-${stage.id} node-${state} ${activeStage === stage.id ? 'is-selected' : ''}`} onClick={() => { setSelected(stage.id); setExpanded(false) }} aria-pressed={activeStage === stage.id} aria-label={`${stage.label}: ${events.length ? events.map((item) => label(item)).join(', ') : 'sem ações nesta etapa'}`}><b><CommandIcon name={stage.icon as IconName} size={19}/></b><span>{stage.label}</span><small>{state === 'waiting' ? '—' : `${events.length} ${events.length === 1 ? 'AÇÃO' : 'AÇÕES'}`}</small></button>
      })}
    </div>
    <div className="neural-process-channel"><span>{selected ? 'ETAPA SELECIONADA' : 'ACOMPANHANDO A CONSULTA'}</span><button onClick={() => { setExpanded(!expanded); setSelected(null) }}>{expanded ? 'Focar etapa' : 'Todas as ações'} ↗</button></div>
    <div className="neural-process-events" role="log" aria-label="Detalhes das ações realizadas">{visible.length ? visible.slice(-8).map((item) => <details key={item.id} className={`neural-event event-${item.status}`} open={item.status === 'running' || visible.length === 1}><summary><span className="neural-event-signal"/><span>{label(item)}</span><time aria-hidden="true">{Math.max(0, Math.floor(((item.finishedAt ?? now) - item.startedAt) / 1000))}s</time></summary><div><span>{statusLabel[item.status]}</span><p>{item.detail || 'Etapa registrada pelo assistente.'}</p>{item.status === 'running' && ['data', 'search', 'browser'].includes(item.kind) && now - item.startedAt >= 8000 && <p>Aguardando retorno da fonte. Você pode interromper a consulta.</p>}</div></details>) : <p className="neural-stage-empty">Nenhuma ação registrada nesta etapa.</p>}</div>
  </section>
}
