import { useEffect, useState } from 'react'
import { useStore } from '../store'

const states = { running: 'Em andamento', done: 'Concluído', error: 'Não concluído', cancelled: 'Interrompido' }
const marks = { running: '◌', done: '✓', error: '!', cancelled: '—' }

export function ActivityTimeline() {
  const activities = useStore((s) => s.activities)
  const phase = useStore((s) => s.phase)
  const [expanded, setExpanded] = useState(true)
  const [now, setNow] = useState(Date.now())
  const running = activities.some((item) => item.status === 'running')
  const current = [...activities].reverse().find((item) => item.status === 'running') ?? activities.at(-1)
  const headline = running ? current?.label : activities.some((item) => item.status === 'error') ? 'Concluído com aviso' : activities.some((item) => item.status === 'cancelled') ? 'Solicitação interrompida' : 'Resposta concluída'
  useEffect(() => {
    if (!running) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [running])
  useEffect(() => { if (phase === 'thinking' || phase === 'tooling') setExpanded(true) }, [phase])
  if (!activities.length) return null
  return <section className={`ocular-activity ${running ? 'is-working' : ''}`} aria-label="Andamento das ações do Jarvis">
    <button className="ocular-activity-toggle" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls="ocular-action-steps">
      <span><i />{running ? 'ATIVIDADE AO VIVO' : 'ÚLTIMA SOLICITAÇÃO'}</span><span>{expanded ? '−' : '+'}</span>
    </button>
    <div className="ocular-activity-current" role="status"><span>{headline}</span>{running && <span className="ocular-activity-wave" aria-hidden="true"><i/><i/><i/></span>}</div>
    {expanded && <ol className="ocular-activity-steps" id="ocular-action-steps">{activities.map((item) => {
      const seconds = Math.max(0, Math.floor(((item.finishedAt ?? now) - item.startedAt) / 1000))
      return <li key={item.id} className={`activity-${item.status}`}>
        <span className="ocular-step-mark" aria-label={states[item.status]}>{marks[item.status]}</span>
        <details><summary><span>{item.detail === 'ToolSearch' ? 'Localizando a integração necessária' : item.label}</span><time aria-hidden="true">{seconds}s</time></summary><p>{item.detail || states[item.status]}</p>{item.status === 'running' && seconds >= 8 && <p className="ocular-step-wait">Ainda aguardando retorno. Você pode interromper pelo microfone.</p>}</details>
      </li>
    })}</ol>}
    <p className="ocular-activity-note">Ações e consultas realizadas pelo assistente.</p>
  </section>
}
