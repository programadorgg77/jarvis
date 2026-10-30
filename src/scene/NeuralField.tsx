import { useEffect, useRef } from 'react'
import { useStore } from '../store'

/** Decorative optics. Text ribbons contain only observed actions. */
export function NeuralField() {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const element = canvas.current
    const ctx = element?.getContext('2d')
    if (!element || !ctx) return
    let width = 1, height = 1, frame = 0, time = 0, previous = 0
    const planet = document.createElement('canvas')
    const paintPlanet = () => {
      planet.width = Math.round(width); planet.height = Math.round(height)
      const p = planet.getContext('2d')
      if (!p) return
      const cx = width * .5, cy = height * 1.36, rx = width * .64, ry = height * .73
      const surface = p.createLinearGradient(0, height * .62, 0, height)
      surface.addColorStop(0, '#031522'); surface.addColorStop(.13, '#071622'); surface.addColorStop(.6, '#01080f'); surface.addColorStop(1, '#010409')
      p.save(); p.beginPath(); p.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); p.clip(); p.fillStyle = surface; p.fillRect(0, 0, width, height)
      for (let i = 0; i < 2400; i++) {
        const x = ((i * .61803398875) % 1) * width, y = height * (.62 + ((i * .41421356237) % 1) * .4)
        const density = Math.sin(x * .017 + Math.sin(y * .023) * 3) + Math.cos(y * .038 - x * .006)
        if (density < .55) continue
        p.fillStyle = `rgba(92,165,205,${.035 + (i % 5) * .025})`; p.fillRect(x, y, i % 13 === 0 ? 2.4 : 1, .7)
      }
      p.filter = 'blur(8px)'
      for (let i = 0; i < 100; i++) {
        const x = ((i * .61803398875) % 1) * width, y = height * (.65 + ((i * .41421356237) % 1) * .3)
        p.fillStyle = `rgba(95,145,177,${.025 + (i % 4) * .008})`
        p.beginPath(); p.ellipse(x, y, 15 + i % 47, 2 + i % 9, Math.sin(i) * .4, 0, Math.PI * 2); p.fill()
      }
      p.filter = 'none'
      p.restore()
      p.strokeStyle = '#4e9dc977'; p.lineWidth = 1; p.shadowColor = '#4091d0'; p.shadowBlur = 24
      p.beginPath(); p.ellipse(cx, cy, rx, ry, 0, Math.PI, Math.PI * 2); p.stroke(); p.shadowBlur = 0
      const shade = p.createLinearGradient(0, height * .73, 0, height)
      shade.addColorStop(0, '#01040800'); shade.addColorStop(1, '#010408ed'); p.fillStyle = shade; p.fillRect(0, 0, width, height)
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const resize = () => {
      width = element.clientWidth; height = element.clientHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      element.width = Math.round(width * dpr); element.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      paintPlanet()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(element); resize()
    const particles = Array.from({ length: 95 }, (_, i) => ({ x: (i * .61803398875) % 1, y: (i * .41421356237) % 1, speed: .012 + (i % 7) * .004, size: i % 5 === 0 ? 1.5 : .7 }))
    const draw = (timestamp: number) => {
      frame = requestAnimationFrame(draw)
      if (document.hidden || timestamp - previous < 1000 / (reduced.matches ? 8 : 30)) return
      const dt = Math.min((timestamp - previous) / 1000 || .03, .1)
      previous = timestamp; time += dt * (reduced.matches ? .06 : 1)
      const state = useStore.getState()
      const live = !['offline', 'boot'].includes(state.phase)
      const working = state.phase === 'thinking' || state.phase === 'tooling'
      const energy = live ? 1 : .45, cx = width * .5, cy = height * .46
      const radius = Math.min(height * .32, width * .20, 300)
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(planet, 0, 0, width, height)
      const halo = ctx.createRadialGradient(cx, cy, radius * .3, cx, cy, radius * 1.9)
      halo.addColorStop(0, `rgba(24,83,111,${.07 * energy})`)
      halo.addColorStop(.65, `rgba(12,48,79,${.14 * energy})`)
      halo.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = halo; ctx.fillRect(0, 0, width, height)
      ctx.lineWidth = .6; ctx.strokeStyle = `rgba(93,181,220,${.035 * energy})`
      const horizon = height * .72
      for (let i = -10; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 18, horizon); ctx.lineTo(cx + i * width * .12, height); ctx.stroke() }
      for (let i = 0; i < 8; i++) {
        const progress = (i / 8 + time * .025) % 1, y = horizon + progress * progress * (height - horizon)
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke()
      }
      ctx.save(); ctx.translate(cx, cy)
      for (let ring = 0; ring < 3; ring++) {
        ctx.save(); ctx.rotate(time * (ring % 2 ? -.055 : .035) + ring * .3); ctx.scale(1, .94 + ring * .02)
        const r = radius * (1.03 + ring * .18)
        ctx.strokeStyle = `rgba(${ring === 1 ? '255,177,102' : '92,213,255'},${(.17 - ring * .035) * energy})`
        ctx.setLineDash(ring === 1 ? [2, 12, 25, 14] : [r * .5, r * .22])
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore()
      }
      ctx.setLineDash([])
      for (let i = 0; i < 96; i++) {
        const angle = i * Math.PI * 2 / 96, r = radius * 1.32, length = i % 8 === 0 ? 11 : 4
        ctx.strokeStyle = `rgba(119,209,243,${(i % 8 === 0 ? .42 : .12) * energy})`
        ctx.beginPath(); ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r)
        ctx.lineTo(Math.cos(angle) * (r + length), Math.sin(angle) * (r + length)); ctx.stroke()
      }
      ctx.restore()
      for (const particle of particles) {
        const px = ((particle.x + time * particle.speed * (working ? 1.8 : .6)) % 1) * width, py = particle.y * height
        ctx.fillStyle = `rgba(146,221,255,${.38 * energy})`; ctx.fillRect(px, py, particle.size, particle.size)
        if (live && particle.size > 1) { ctx.strokeStyle = 'rgba(92,211,255,.13)'; ctx.beginPath(); ctx.moveTo(px - (working ? 35 : 12), py); ctx.lineTo(px, py); ctx.stroke() }
      }
      if (live) {
        ctx.font = '9px "JetBrains Mono", monospace'
        state.activities.slice(-5).forEach((item, i) => {
          const x = width - ((time * (28 + i * 8) + i * width * .27) % (width + 340)), y = height * (.25 + i * .125)
          ctx.fillStyle = 'rgba(115,200,234,.18)'; ctx.fillText(item.label.toUpperCase(), x, y)
          ctx.fillStyle = 'rgba(115,200,234,.05)'; ctx.fillRect(x - 12, y - 11, Math.min(item.label.length * 6 + 24, 350), 17)
        })
      }
    }
    frame = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(frame); observer.disconnect() }
  }, [])
  return <div className="neural-field" aria-hidden="true"><canvas ref={canvas} /><div className="neural-optic-sweep" /><div className="neural-scanlines" /></div>
}
