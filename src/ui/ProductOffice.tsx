import { useEffect, useId, useRef, useState } from 'react'
import { useStore, type BusinessSnapshot } from '../store'
import { OFFICE_METRICS, type OfficeMetric } from '../lib/officeDisplay'
import { officePose } from '../lib/officeMotion'
import './product-office.css'

const colors = ['#325775', '#586579', '#6b557a', '#365e61']
const skins = ['#dbab89', '#ac7759', '#e8bfa0', '#bc8c68']
const money = (value: number, currency: string) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)
function valueFor(metric: OfficeMetric, snapshot: BusinessSnapshot | null) {
  const value = snapshot?.[metric]
  if (value == null || !Number.isFinite(value)) return '—'
  if (metric === 'orders') return value.toLocaleString('pt-BR')
  if (metric === 'roas') return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}×`
  return money(value, snapshot!.currency)
}

function Desk({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x} ${y})`}>
    <ellipse cx="24" cy="24" rx="31" ry="7" fill="#020a11" opacity=".22"/>
    <path d="M0 0v22m43-15v22m-8-7v18" stroke="#78919d" strokeWidth="2.2" />
    <path d="M-3 23h6m37 7h6m-14 5h6" stroke="#2b4355" strokeWidth="2"/>
    <path d="m-8-7 43-5 18 13-44 7Z" fill="#8a8175" stroke="#b6b1a0" strokeWidth=".7" />
    <path d="m-5-5 39-4 15 10-39 6Z" fill="#526371" opacity=".35"/>
    <path d="m9 8 44-7v4L9 12Z" fill="#4d5152" />
    <path d="m20-10 19-2v-17l-19 2Z" fill="#071d2b" stroke="#63d9ef" strokeWidth=".8" />
    <path className="office-monitor" d="m23-13 13-1.4v-11l-13 1.4Z" fill="#25839c" />
    <path d="m25-21 7-.8m-7 4 10-1" stroke="#a7f5ff" strokeWidth=".8" opacity=".7" />
    <path d="m29-10 .5 5m-5 0 11-1" stroke="#5695a9" strokeWidth="1.2" />
    <path d="m12-2 14-1.5 5 3.5-14 1.5Z" fill="#326174" />
    <path d="m15-1 10-1m-8 3 10-1" stroke="#a6bcc7" strokeWidth=".45"/>
    <ellipse cx="37" cy="-1" rx="2" ry="1.5" fill="#c2cdd1"/>
    <path d="m-2-3 7-1 5 3-7 1Z" fill="#c5d6d9"/><path d="m0-2 4-.4" stroke="#6f8b9b" strokeWidth=".5"/>
    <path d="M44-5v-5m-2 0h4" stroke="#f4bc85" strokeWidth="2" />
  </g>
}

function Worker({ index, nodeRef }: { index: number; nodeRef: (node: SVGGElement | null) => void }) {
  const pose = officePose(index, 0)
  return <g ref={nodeRef} transform={`translate(${pose.x} ${pose.y})`} aria-hidden="true">
    <ellipse className="worker-shadow" cy="5" rx="11" ry="3" fill="#000" opacity=".3" />
    <g className="worker-chair" opacity={pose.seated}><path d="M-9-12v-15m0 15h14" stroke="#182b3e" strokeWidth="7" strokeLinecap="round"/><path d="M-10-25v10" stroke="#668090" strokeWidth=".8"/><path d="M-3-10v14m-8 1 8-1 8 3m-8-3-2 4" stroke="#7b909b" strokeWidth="1.3"/><path d="M-11 6h3m10 2h3m-12 1h3" stroke="#11212c" strokeWidth="2.2"/></g>
    <g className="worker-facing"><g className="worker-torso">
      <path className="worker-leg-a" d="M-3-16-5-5-4 5"/><path className="worker-leg-b" d="M3-16 5-5 6 5"/>
      <path className="worker-shirt" d="M-6-31Q0-34 6-31L5-16Q0-14-5-16Z" fill={colors[index]}/>
      <path d="m-3-32 3 6 3-6" fill="#dce5e8"/><path d="m-1-29 1-2 1 2-1 8Z" fill={index === 1 ? '#c6a67a' : '#80b3c9'}/><path d="m-4-31 1 5 3 1m4-6-1 5-3 1M0-24v9" fill="none" stroke="#a6bbcd55" strokeWidth=".55"/>
      <path className="worker-arm-a" d="M-5-29-8-21-7-13" stroke={skins[index]}/>
      <path className="worker-arm-b" d="M5-29 8-21 7-13" stroke={skins[index]}/>
      <path className="worker-sleeve-a" d="M-5-30-7-23" stroke={colors[index]}/><path className="worker-sleeve-b" d="M5-30 7-23" stroke={colors[index]}/>
      <g className="worker-head"><path d="M-1-34v-4" stroke={skins[index]} strokeWidth="4"/><path d="M-5-43Q-3-48 3-46L6-42l1 4-2 1q-1 5-6 3l-4-4Z" fill={skins[index]}/><path d="M-4-39q-2 4 3 4" stroke="#795a4c" strokeWidth=".6" fill="none" opacity=".4"/><ellipse cx="-4" cy="-39" rx="1.2" ry="1.8" fill={skins[index]}/><path d={index === 2 ? 'M-6-39Q-11-50-1-49 9-50 7-34L4-39 3-44-6-39Z' : 'M-6-40Q-8-49 0-49 8-48 6-41L2-44-6-40Z'} fill={index === 1 ? '#352b2b' : '#192b3e'}/><path d="M-3-45q4-3 7 0" fill="none" stroke="#ffffff1a" strokeWidth=".8"/><circle cx="3" cy="-40" r=".65" fill="#283547"/><path d="m5-37-2 1" stroke="#8d5c48" strokeWidth=".65"/>{index === 0 && <path d="M0-41h5v3H1Zm-4 1 4 1" fill="none" stroke="#253d51" strokeWidth=".7"/>}</g>
      <g className="worker-paper" opacity="0"><path d="M10-22h12v15H10Z" fill="#e6f0ed"/><path d="M12-19h7m-7 3h6m-6 3h7" stroke="#6791a0" strokeWidth=".7"/></g>
      <g className="worker-cup" opacity="0"><path d="M10-31h6v7h-6Z" fill="#d5e8e9"/><path d="M16-29q5-1 0 4" fill="none" stroke="#d5e8e9" strokeWidth="1.3"/></g>
    </g></g>
  </g>
}

function DashboardScreen({ snapshot, metrics }: { snapshot: BusinessSnapshot | null; metrics: OfficeMetric[] }) {
  const series = (snapshot?.series ?? []).filter((point) => Number.isFinite(point.value))
  const max = Math.max(...series.map((point) => point.value), 1)
  const points = series.map((point, i) => `${10 + i * 250 / Math.max(1, series.length - 1)},${77 - point.value / max * 16}`).join(' ')
  return <g transform="translate(151 13)">
    <rect x="-3" y="-3" width="276" height="88" rx="5" fill="#173d50" stroke="#4c94ad" strokeWidth=".8"/>
    <rect width="270" height="82" rx="3" fill="#031520"/>
    <circle cx="10" cy="10" r="2" fill={snapshot ? '#6be3b7' : '#7c95a7'}/>
    <text x="17" y="12" fill="#a1d4e5" fontSize="7" letterSpacing="1">PAINEL DO PRODUTO</text>
    <text x="259" y="12" textAnchor="end" fill="#79a7ba" fontSize="5.5">{snapshot ? 'ÚLTIMA CONSULTA' : 'AGUARDANDO UTMIFY'}</text>
    {metrics.map((metric, i) => {
      const value = valueFor(metric, snapshot)
      return <g key={metric} transform={`translate(${10 + i * 253 / metrics.length} 25)`}>
        <text fill="#719cae" fontSize="6.5" letterSpacing=".7">{OFFICE_METRICS[metric].toUpperCase()}</text>
        <text y="17" fill={metric === 'profit' && (snapshot?.profit ?? 0) < 0 ? '#ffaaa4' : '#c6f7ff'} fontSize={Math.min(14, (253 / metrics.length - 8) / Math.max(value.length * .57, 1))} fontFamily="'JetBrains Mono', monospace">{value}</text>
      </g>
    })}
    <path d="M10 60h250M10 78h250" stroke="#3c6476" strokeWidth=".4"/>
    {series.length > 1 ? <><polyline points={points} fill="none" stroke="#5ddded" strokeWidth="1.2"/><text x="258" y="58" textAnchor="end" fill="#688f9f" fontSize="4.5">SÉRIE: FATURAMENTO</text></> : <text x="135" y="71" textAnchor="middle" fill="#547a8d" fontSize="5.5">{snapshot ? 'SÉRIE TEMPORAL NÃO INFORMADA PELA FONTE' : 'CONECTE A UTMIFY PARA CONSULTAR SEUS RESULTADOS'}</text>}
  </g>
}

function OfficeStage({ paused, snapshot, metrics }: { paused: boolean; snapshot: BusinessSnapshot | null; metrics: OfficeMetric[] }) {
  const id = useId().replace(/:/g, '')
  const workers = useRef<(SVGGElement | null)[]>([])
  const paper = useRef<SVGGElement>(null)
  const elapsed = useRef(0)
  useEffect(() => {
    const nodes = workers.current.map((root) => {
      const find = (selector: string) => root!.querySelector<SVGElement>(selector)!
      return { root: root!, chair: find('.worker-chair'), facing: find('.worker-facing'), torso: find('.worker-torso'), head: find('.worker-head'), legs: [find('.worker-leg-a'), find('.worker-leg-b')], arms: [find('.worker-arm-a'), find('.worker-arm-b')], sleeves: [find('.worker-sleeve-a'), find('.worker-sleeve-b')], paper: find('.worker-paper'), cup: find('.worker-cup') }
    })
    const preference = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let previous = 0
    let lastPaint = 0
    let visible = true
    let painted = false
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting }, { rootMargin: '40px' })
    if (workers.current[0]?.ownerSVGElement) observer.observe(workers.current[0].ownerSVGElement)
    function paint(now: number) {
      const dt = previous ? Math.min((now - previous) / 1000, .05) : 0
      previous = now
      const frozen = paused || document.hidden || preference.matches || !visible
      if (!frozen) elapsed.current += dt
      if ((!frozen || !painted) && now - lastPaint > 32) {
        painted = true
        lastPaint = now
        const t = elapsed.current
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i]
          const p = officePose(i, t)
          const stride = p.walking ? Math.sin(t * 10.5 + i) : 0
          const bob = p.walking ? Math.abs(Math.sin(t * 10.5 + i)) * 1.2 : Math.sin(t * 1.9 + i * 2) * .35
          n.root.setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`)
          n.facing.setAttribute('transform', `scale(${p.facing} 1)`)
          n.chair.setAttribute('opacity', String(p.seated))
          n.torso.setAttribute('transform', `translate(0 ${(p.seated * 5 - bob).toFixed(2)}) rotate(${p.walking ? 2 + stride * .8 : Math.sin(t * .8 + i) * .8} 0 -17)`)
          n.head.setAttribute('transform', `rotate(${Math.sin(t * 1.4 + i * 3) * (p.walking ? 2 : 5)} 0 -34)`)
          for (let side = 0; side < 2; side++) {
            const hip = side ? 3 : -3
            const swing = (side ? -stride : stride) * .55
            const kneeX = hip + Math.sin(swing) * 11
            const kneeY = -16 + Math.cos(swing) * 11
            const flex = Math.max(0, -(side ? -stride : stride)) * .9
            const footX = kneeX + Math.sin(swing + flex) * 10
            const footY = kneeY + Math.cos(swing + flex) * 10
            const s = p.seated
            const mix = (a: number, b: number) => a + (b - a) * s
            n.legs[side].setAttribute('d', `M${hip} -16 Q${mix(kneeX, 8 + side * 4)} ${mix(kneeY, -14)} ${mix(footX, 11 + side * 4)} ${mix(footY, -1)}`)
            const shoulder = side ? 5 : -5
            let elbowX = shoulder + (side ? 2 : -2) - stride * (side ? 4 : -4)
            let elbowY = -22
            let handX = shoulder - stride * (side ? 6 : -6)
            let handY = -13
            if (p.action === 'work' || s > .5) { elbowX = 3 + side * 6; elbowY = -24; handX = 14 + side * 4; handY = -24 + Math.sin(t * (side ? 13 : 10) + i) * 1.2 }
            if (p.action === 'print') { elbowX = 5 + side * 4; elbowY = -20; handX = 17; handY = -18 + Math.sin(t * 3) * 2 }
            if (p.action === 'talk' && side === 1) { elbowX = 12; elbowY = -26; handX = 16 + Math.sin(t * 3) * 3; handY = -32 + Math.cos(t * 3) * 4 }
            if (p.action === 'coffee' && side === 1) { elbowX = 13; elbowY = -21; handX = 12; handY = -31 }
            if (p.paper && side === 1) { elbowX = 7; elbowY = -19; handX = 15; handY = -17 }
            n.arms[side].setAttribute('d', `M${shoulder} -30 L${elbowX} ${elbowY} ${handX} ${handY}`)
            n.sleeves[side].setAttribute('d', `M${shoulder} -30 L${shoulder + (elbowX - shoulder) * .84} ${-30 + (elbowY + 30) * .84}`)
          }
          n.paper.setAttribute('opacity', p.paper && (p.action !== 'print' || p.elapsed > 2.5) ? '1' : '0')
          n.cup.setAttribute('opacity', p.action === 'coffee' ? '1' : '0')
        }
        const printing = officePose(1, t)
        paper.current?.setAttribute('transform', `translate(0 ${printing.action === 'print' ? Math.min(9, printing.elapsed * 4) : 0})`)
        paper.current?.setAttribute('opacity', printing.action === 'print' && printing.elapsed < 2.5 ? '1' : '0')
      }
      frame = requestAnimationFrame(paint)
    }
    frame = requestAnimationFrame(paint)
    return () => { cancelAnimationFrame(frame); observer.disconnect() }
  }, [paused])
  return <svg className="office-stage" viewBox="0 0 480 282" role="img" aria-label="Escritório ilustrativo com quatro colegas: digitando, conversando, tomando café e caminhando até a impressora. O telão mostra os indicadores escolhidos da última consulta.">
    <defs>
      <linearGradient id={`${id}-floor`} x2="1" y2="1"><stop stopColor="#45606d"/><stop offset=".5" stopColor="#283e4f"/><stop offset="1" stopColor="#172c3c"/></linearGradient>
      <linearGradient id={`${id}-wall`} x2="0" y2="1"><stop stopColor="#263e51"/><stop offset="1" stopColor="#112533"/></linearGradient>
      <linearGradient id={`${id}-glass`} x2=".3" y2="1"><stop stopColor="#7295ab" stopOpacity=".65"/><stop offset="1" stopColor="#163c56"/></linearGradient>
      <clipPath id={`${id}-windows`}><path d="m35 75 40-18v50l-40 21Zm51-23 40-18v50L86 105Z"/></clipPath>
    </defs>
    <path d="M18 178V69L176 0l286 93v87L282 279Z" fill={`url(#${id}-wall)`} stroke="#2b576b" strokeWidth=".8"/>
    <path d="m18 178 158-86 286 88-180 99Z" fill={`url(#${id}-floor)`} stroke="#3b7085" strokeWidth=".8"/>
    <path d="M20 176 176 91 461 179M20 70 176 2l286 92" fill="none" stroke="#a5b9c4" strokeWidth="1" opacity=".55"/>
    <path d="m28 72 148-64m6 1 267 89" stroke="#b0e5ee" strokeWidth="1.6" opacity=".75"/>
    <path d="m28 75 148-64m6 1 267 89" stroke="#6bafc8" strokeWidth="4" opacity=".1"/>
    <path d="m68 207 165-98m-116 125 173-106m-117 132 180-112M57 158l266 98M102 133l268 96M143 109l270 97" fill="none" stroke="#2c5265" strokeWidth=".6" opacity=".55"/>
    <path d="m35 75 40-18v50l-40 21Zm51-23 40-18v50L86 105Z" fill={`url(#${id}-glass)`} stroke="#829faf" strokeWidth="1"/>
    <g clipPath={`url(#${id}-windows)`} opacity=".35"><path d="M34 123V95h7V82h6v27h5V92h9V72h6v29h6V78h11v17h5V65h8V50h7v30h5V62h6V45h8v40h7v50Z" fill="#10293e"/><path d="m40 76 21-10m30-13 25-11" stroke="#d4e7ec" strokeWidth="2" opacity=".5"/></g>
    <path d="M55 66v52m51-75v52m-71 8 40-18m11-5 40-18" stroke="#5b8ea4" opacity=".6"/>
    <DashboardScreen snapshot={snapshot} metrics={metrics}/>
    <path d="m89 162 125-55 177 67-125 70Z" fill="#142b3c" stroke="#566d7d" strokeWidth=".6" opacity=".8"/>
    <path d="m96 163 119-51 168 63-118 62Z" fill="none" stroke="#607682" strokeWidth=".45" opacity=".5"/>
    <g transform="translate(31 150)"><path d="m0 0 22-10 12 5-22 10Z" fill="#849699"/><path d="M0 0v24l12 6V5m0 25 22-10V-5" fill="#294354" stroke="#657e8e" strokeWidth=".6"/><path d="m14 9 17-7m-17 15 17-7" stroke="#79919d" strokeWidth=".6"/><path d="m3-4 0-10 5-2v10m3-3v-10l5-2v10m3-2v-9l4-2v9" fill="#7e9fb2" stroke="#b7cbd5" strokeWidth=".5"/></g>
    <g transform="translate(430 169)"><path d="M-9 0H9L6 17H-6Z" fill="#456b77"/><path d="M0 0v-27m0 15q-18-2-15-16Q0-26 0-12m0-5q18 0 14-16Q0-27 0-17" fill="#4b9c87" stroke="#7ac6a5" strokeWidth="1"/></g>
    <g transform="translate(405 143)"><path d="M-13-4 9-9l12 8L-1 4Z" fill="#2e5766"/><path d="M-13-4v19L-1 22V4m0 18 22-6V-1" fill="#163445" stroke="#43758c" strokeWidth=".7"/><rect x="-5" y="-22" width="14" height="16" rx="3" fill="#7897a3"/><path d="M-3-18H6v5H-3Z" fill="#263e4e"/><path d="M1-9v4" stroke="#70dce2"/><path d="M0 0h5v5H0Z" fill="#e2c7a5"/></g>
    <Worker index={0} nodeRef={(node) => { workers.current[0] = node }}/><Worker index={1} nodeRef={(node) => { workers.current[1] = node }}/>
    <Desk x={111} y={145}/><Desk x={314} y={145}/>
    <g transform="translate(43 199)"><path d="m-9 0 28-8 14 8-28 9Z" fill="#5f8799"/><path d="M-9 0v24l14 8V9m0 23 28-9V0" fill="#254b60" stroke="#52899f" strokeWidth=".8"/><path d="M-6 5 9 10l19-6v8L9 18-6 12Z" fill="#101f2d"/><path d="m-4-4 0-12 24-6v14Z" fill="#8cabb8"/><path d="m0-10 15-4" stroke="#cfebf2"/><g ref={paper} opacity="0"><path d="m3 8 18-4v12L3 20Z" fill="#dfedef"/><path d="m6 11 12-3m-12 6 12-3" stroke="#87a4af" strokeWidth=".7"/></g><circle cx="26" cy="-2" r="1.5" fill="#84e6b0"/></g>
    <Worker index={2} nodeRef={(node) => { workers.current[2] = node }}/><Worker index={3} nodeRef={(node) => { workers.current[3] = node }}/>
    <Desk x={214} y={224}/><Desk x={379} y={220}/>
  </svg>
}

export function ProductOffice({ onRefresh, busy = false }: { onRefresh: () => void; busy?: boolean }) {
  const godEyeActive = useStore((s) => s.godEyeActive)
  const snapshot = useStore((s) => s.businessSnapshot)
  const metrics = useStore((s) => s.officeMetrics)
  const setMetrics = useStore((s) => s.setOfficeMetrics)
  const [paused, setPaused] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (expanded) dialog.current?.showModal(); else dialog.current?.close() }, [expanded])
  const toggleMetric = (metric: OfficeMetric) => {
    if (metrics.includes(metric)) { if (metrics.length > 1) setMetrics(metrics.filter((item) => item !== metric)) }
    else setMetrics([...metrics.slice(-(3 - 1)), metric])
  }
  const choices = <div className="office-metric-choices" aria-label="Indicadores do telão">{(Object.keys(OFFICE_METRICS) as OfficeMetric[]).map((metric) => <button key={metric} type="button" aria-pressed={metrics.includes(metric)} onClick={() => toggleMetric(metric)}>{OFFICE_METRICS[metric]}</button>)}</div>
  const controls = <><button type="button" onClick={() => setPaused(!paused)} aria-label={paused ? 'Retomar animação do escritório' : 'Pausar animação do escritório'} aria-pressed={paused}>{paused ? '▶' : 'Ⅱ'}</button><button type="button" onClick={() => setExpanded(true)} aria-label="Ampliar escritório e telão">⛶</button></>
  const status = snapshot ? `${snapshot.source} · ${snapshot.period} · consultado às ${new Date(snapshot.queriedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'UTMify aguardando consulta · sem valores disponíveis'
  const readout = <div className="office-metric-readout">{metrics.map((metric) => <span key={metric}>{OFFICE_METRICS[metric]}<strong>{valueFor(metric, snapshot)}</strong></span>)}</div>
  return <>
    <section className={`product-office ${paused ? 'is-paused' : ''}`} aria-label="Escritório animado da equipe do produto">
      <header><span><i/>EQUIPE DO PRODUTO <small>04</small></span><nav aria-label="Controles do escritório">{controls}</nav></header>
      <OfficeStage paused={paused || expanded || godEyeActive} snapshot={snapshot} metrics={metrics}/>
      <details className="office-screen-settings"><summary>PERSONALIZAR TELÃO <span>⌄</span></summary>{choices}<p>Escolha até 3 indicadores. Por voz: “Quero lucro e vendas no telão”.</p></details>
      <footer><span>{status}</span><button type="button" onClick={onRefresh} disabled={busy}>{busy ? 'AGUARDE…' : '↻ ATUALIZAR'}</button></footer>
    </section>
    <dialog className={`office-dialog ${paused ? 'is-paused' : ''}`} ref={dialog} onClose={() => setExpanded(false)} aria-label="Escritório da equipe e resultados do produto">
      {expanded && <><header><div><span>EQUIPE DO PRODUTO</span><h2>Seu escritório em movimento.</h2></div><nav><button type="button" onClick={() => setPaused(!paused)}>{paused ? 'Retomar' : 'Pausar'}</button><button type="button" onClick={() => setExpanded(false)} aria-label="Fechar escritório ampliado">×</button></nav></header>
      <OfficeStage paused={paused} snapshot={snapshot} metrics={metrics}/>{readout}{choices}<p className="office-source">{status}</p><footer><span>Escritório ilustrativo · resultados da última consulta</span><button type="button" disabled={busy} onClick={onRefresh}>{busy ? 'Aguarde…' : 'Atualizar UTMify'}</button></footer></>}
    </dialog>
  </>
}
