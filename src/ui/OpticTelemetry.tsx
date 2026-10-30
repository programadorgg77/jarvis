import { useEffect, useRef, type CSSProperties } from 'react'
import { useStore } from '../store'
import type { SystemPulse } from '../lib/useSystemPulse'

const modeLabel = { offline: 'EM ESPERA', boot: 'ATIVANDO', dormant: 'ESCUTA', waking: 'ATIVANDO', listening: 'ESCUTA', thinking: 'ANÁLISE', tooling: 'CONSULTA', speaking: 'RESPOSTA' }

export function OpticTelemetry({ pulse }: { pulse: SystemPulse }) {
  const phase = useStore((s) => s.phase)
  const activities = useStore((s) => s.activities)
  const meter = useRef<HTMLDivElement>(null)
  useEffect(() => useStore.subscribe((state) => { meter.current?.style.setProperty('--level', String(state.level)) }), [])
  const source = [...activities].reverse().find((item) => ['data', 'search', 'browser'].includes(item.kind) && item.status === 'running')
  const status = phase === 'speaking' ? 'TRANSMITINDO...' : phase === 'thinking' || phase === 'tooling' ? 'PROCESSANDO...' : pulse.microphone ? 'ESCUTANDO...' : 'AGUARDANDO...'
  return <div className="optic-telemetry" aria-label="Estado do núcleo e da entrada de voz">
    <section className="optic-readout optic-readout-left"><h2>{status}</h2><div className="optic-mini-wave" ref={meter} aria-hidden="true">{Array.from({ length: 34 }, (_, i) => <i key={i} style={{ '--bar': `${Math.abs(Math.sin(i * 1.3)) * 22 + 4}px`, '--delay': `${i * -.08}s` } as CSSProperties}/>)}</div><dl><div><dt>MICROFONE</dt><dd className={pulse.microphone ? 'is-online' : ''}>{pulse.microphone ? 'ATIVO' : 'EM ESPERA'}</dd></div><div><dt>IDIOMA</dt><dd>PT-BR</dd></div><div><dt>RECONHECIMENTO</dt><dd>{pulse.engine}</dd></div><div><dt>CONSULTAS</dt><dd>{activities.filter((item) => ['data', 'search', 'browser'].includes(item.kind)).length}</dd></div></dl></section>
    <section className="optic-readout optic-readout-right"><h2>NÚCLEO {pulse.online ? 'ONLINE' : pulse.online === false ? 'OFFLINE' : 'CONECTANDO'}</h2><dl><div><dt>MODO</dt><dd>{modeLabel[phase]}</dd></div><div><dt>LATÊNCIA</dt><dd>{pulse.latency !== null ? `${pulse.latency} ms` : '—'}</dd></div><div><dt>MOTOR</dt><dd>CLAUDE</dd></div><div><dt>STATUS</dt><dd className={pulse.online ? 'is-online' : ''}>{pulse.online ? 'CONECTADO' : 'EM ESPERA'}</dd></div></dl>{source && <p className="optic-current-source">{source.label}</p>}</section>
  </div>
}

export function OpticReticle() {
  return <div className="optic-reticle" aria-hidden="true"><svg viewBox="0 0 600 600"><defs><linearGradient id="optic-arc"><stop stopColor="#0f506c" stopOpacity=".3"/><stop offset=".55" stopColor="#ff7b20"/><stop offset="1" stopColor="#ffd393" stopOpacity=".5"/></linearGradient></defs><circle className="optic-outer-line" cx="300" cy="300" r="286"/><circle className="optic-blue-ticks" cx="300" cy="300" r="277"/><circle className="optic-track" cx="300" cy="300" r="263"/><circle className="optic-amber-ring" cx="300" cy="300" r="252"/><circle className="optic-inner-ring" cx="300" cy="300" r="235"/><circle className="optic-orbit-a" cx="300" cy="300" r="281"/><circle className="optic-orbit-b" cx="300" cy="300" r="268"/><circle className="optic-orbit-c" cx="300" cy="300" r="243"/><path className="optic-cross" d="M300 3v24 M300 573v24 M3 300h24 M573 300h24"/><g className="optic-cardinal"><circle cx="18" cy="300" r="3"/><circle cx="582" cy="300" r="3"/><circle cx="300" cy="18" r="2"/><circle cx="300" cy="582" r="2"/></g></svg></div>
}
