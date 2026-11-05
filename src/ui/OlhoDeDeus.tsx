import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Html } from '@react-three/drei'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import {
  connectGoogleTag,
  isGoogleTagId,
  normaliseGoogleTagId,
  pauseGoogleTagEvents,
  readGoogleTagId,
  saveGoogleTagId,
  sendGoogleTagEvent,
} from '../lib/googleTag'
import type { AssistantActions } from './OcularInterface'
import { readUtmAttribution, useUtmifyStatus } from '../lib/utmify'
import { useLiveAnalytics, type VisitorRegion } from '../lib/analytics'
import { AnalyticsSettings } from './AnalyticsSettings'

type EventParams = Record<string, string | number | boolean | undefined>
type TagStatus = 'not-configured' | 'loading' | 'connected' | 'error'
type ObservedEvent = { id: number; name: string; title: string; detail: string; at: number }
type GlobeMotion = { yaw: number; pitch: number; velocityYaw: number; velocityPitch: number; dragging: boolean; target?: { yaw: number; pitch: number } }

const EARTH_RADIUS = 1.58
const MAX_PITCH = 1.12
const IDLE_SPIN = 0.14
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

function earthPoint(latitude: number, longitude: number, radius = EARTH_RADIUS + 0.015): THREE.Vector3 {
  const phi = ((90 - latitude) * Math.PI) / 180
  const theta = ((longitude + 180) * Math.PI) / 180
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

function VisitorBeacon({ region, selected }: { region: VisitorRegion; selected: boolean }) {
  const rings = useRef<THREE.Group>(null)
  const position = useMemo(() => earthPoint(region.lat, region.lng, EARTH_RADIUS + 0.025), [region.lat, region.lng])
  const rotation = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), position.clone().normalize()), [position])
  const reducedMotion = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  useFrame(({ clock }) => {
    if (!rings.current) return
    rings.current.children.forEach((ring, index) => {
      const mesh = ring as THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
      const progress = reducedMotion ? 0.35 + index * 0.2 : (clock.elapsedTime * 0.65 + index * 0.5) % 1
      mesh.scale.setScalar(1 + progress * 3.4)
      mesh.material.opacity = (1 - progress) * (selected ? 0.85 : 0.6)
    })
  })
  return <group position={position} quaternion={rotation}>
    <mesh><sphereGeometry args={[selected ? 0.025 : 0.018, 12, 12]} /><meshBasicMaterial color="#7affc0" toneMapped={false} /></mesh>
    <group ref={rings}>{[0, 1].map(index => <mesh key={index} position={[0, 0, 0.004]}><ringGeometry args={[0.027, 0.034, 40]} /><meshBasicMaterial color="#26ff9c" transparent opacity={0.7} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} /></mesh>)}</group>
    <Html position={[0, 0, 0.035]} center occlude zIndexRange={[4, 1]} style={{ pointerEvents: 'none' }}>
      <span className={`god-eye-beacon-label ${selected ? 'is-selected' : ''}`}>{region.activeUsers}</span>
    </Html>
  </group>
}

function EarthSphere({ motion, regions, selected }: { motion: React.RefObject<GlobeMotion>; regions: VisitorRegion[]; selected: string | null }) {
  const earth = useRef<THREE.Group>(null)
  const clouds = useRef<THREE.Mesh>(null)
  const [surface, normal, specular, cloudMap, lights] = useLoader(THREE.TextureLoader, [
    '/earth-blue-marble-5400.jpg', '/earth_normal_2048.jpg',
    '/earth_specular_2048.jpg', '/earth_clouds_2048.png', '/earth-at-night-2016.jpg',
  ])
  const cloudShadow = useMemo(() => ({ map: { value: cloudMap }, offset: { value: 0 } }), [cloudMap])
  const cityUniforms = useMemo(() => ({ cityMap: { value: lights }, sun: { value: new THREE.Vector3(-3, 3, 5).normalize() } }), [lights])
  useEffect(() => {
    surface.colorSpace = cloudMap.colorSpace = THREE.SRGBColorSpace
    for (const texture of [surface, normal, specular, cloudMap]) { texture.anisotropy = 8; texture.needsUpdate = true }
  }, [surface, normal, specular, cloudMap])

  useFrame((_, delta) => {
    if (!earth.current) return
    const state = motion.current
    const dt = Math.min(delta, 0.05)
    if (!state.dragging && state.target) {
      const easing = 1 - Math.exp(-dt * 3.5)
      state.yaw += (state.target.yaw - state.yaw) * easing
      state.pitch += (state.target.pitch - state.pitch) * easing
      if (Math.abs(state.target.yaw - state.yaw) + Math.abs(state.target.pitch - state.pitch) < 0.002) state.target = undefined
    } else if (!state.dragging) {
      if (Math.hypot(state.velocityYaw, state.velocityPitch) > 0.025) {
        state.yaw += state.velocityYaw * dt
        const nextPitch = state.pitch + state.velocityPitch * dt
        state.pitch = clamp(nextPitch, -MAX_PITCH, MAX_PITCH)
        if (state.pitch !== nextPitch) state.velocityPitch = 0
        const drag = Math.exp(-1.3 * dt)
        state.velocityYaw *= drag
        state.velocityPitch *= drag
      } else {
        state.velocityYaw = 0
        state.velocityPitch = 0
        state.yaw += IDLE_SPIN * dt
      }
    }
    earth.current.rotation.set(state.pitch, state.yaw, 0, 'XYZ')
    if (clouds.current) {
      clouds.current.rotation.y += dt * 0.008
      cloudShadow.offset.value = clouds.current.rotation.y / (Math.PI * 2)
    }
  })

  return <group ref={earth}>
    <mesh>
      <sphereGeometry args={[EARTH_RADIUS, 128, 96]} />
      <meshPhongMaterial map={surface} normalMap={normal} normalScale={new THREE.Vector2(0.45, 0.45)}
        specularMap={specular} specular="#101d24" shininess={32}
        emissive="#0b1c30" emissiveIntensity={0.12}
        onBeforeCompile={(shader) => {
          shader.uniforms.uCloudShadow = cloudShadow.map
          shader.uniforms.uCloudOffset = cloudShadow.offset
          shader.fragmentShader = 'uniform sampler2D uCloudShadow; uniform float uCloudOffset;\n' + shader.fragmentShader
          shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
            float cloudCover = texture2D(uCloudShadow, vMapUv + vec2(uCloudOffset + 0.003, -0.002)).a;
            diffuseColor.rgb *= 1.0 - cloudCover * 0.20;
          `)
        }} />
    </mesh>
    <mesh scale={1.001}>
      <sphereGeometry args={[EARTH_RADIUS, 96, 64]} />
      <shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending}
        uniforms={cityUniforms}
        vertexShader={`varying vec2 vUv; varying vec3 vWorldNormal; void main() { vUv = uv; vWorldNormal = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
        fragmentShader={`uniform sampler2D cityMap; uniform vec3 sun; varying vec2 vUv; varying vec3 vWorldNormal; void main() {
          vec3 light = texture2D(cityMap, vUv).rgb;
          float cities = smoothstep(0.38, 0.85, max(light.r, light.g));
          float night = 1.0 - smoothstep(-0.15, 0.35, dot(normalize(vWorldNormal), sun));
          gl_FragColor = vec4(vec3(1.0, 0.72, 0.37), cities * (0.10 + night * 0.85));
        }`} />
    </mesh>
    <mesh ref={clouds} scale={1.006}>
      <sphereGeometry args={[EARTH_RADIUS, 128, 96]} />
      <meshLambertMaterial map={cloudMap} transparent opacity={0.87} depthWrite={false}
        emissive="#0c2030" emissiveIntensity={0.12} />
    </mesh>
    <mesh scale={1.025}>
      <sphereGeometry args={[EARTH_RADIUS, 96, 64]} />
      <shaderMaterial transparent depthWrite={false} side={THREE.BackSide} blending={THREE.AdditiveBlending}
        vertexShader={`
          varying vec3 vNormal;
          varying vec3 vView;
          varying vec3 vWorldNormal;
          void main() {
            vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
            vNormal = normalize(normalMatrix * normal);
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            vView = -viewPosition.xyz;
            gl_Position = projectionMatrix * viewPosition;
          }
        `}
        fragmentShader={`
          varying vec3 vNormal;
          varying vec3 vView;
          varying vec3 vWorldNormal;
          void main() {
            float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 3.4);
            float sunlight = 0.25 + 0.75 * max(dot(normalize(vWorldNormal), normalize(vec3(-3.0, 3.0, 5.0))), 0.0);
            gl_FragColor = vec4(mix(vec3(0.05, 0.24, 0.72), vec3(0.25, 0.67, 1.0), sunlight), rim * sunlight * 0.95);
          }
        `} />
    </mesh>
    {regions.map(region => <VisitorBeacon key={region.id} region={region} selected={selected === region.id} />)}
  </group>
}

function RotatingGlobe({ onDrag, regions, selected }: { onDrag: () => void; regions: VisitorRegion[]; selected: string | null }) {
  const motion = useRef<GlobeMotion>({ yaw: -0.45, pitch: 0.12, velocityYaw: 0, velocityPitch: 0, dragging: false })
  const drag = useRef<{ pointerId: number; x: number; y: number; time: number; width: number; height: number; moved: boolean } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const focusRegion = regions.find(region => region.id === selected)
  const latitude = focusRegion?.lat
  const longitude = focusRegion?.lng
  useEffect(() => {
    if (latitude == null || longitude == null) return
    const point = earthPoint(latitude, longitude)
    const state = motion.current
    const yaw = -Math.atan2(point.x, point.z)
    const difference = Math.atan2(Math.sin(yaw - state.yaw), Math.cos(yaw - state.yaw))
    state.target = { yaw: state.yaw + difference, pitch: clamp(Math.atan2(point.y, Math.hypot(point.x, point.z)), -MAX_PITCH, MAX_PITCH) }
    state.velocityYaw = state.velocityPitch = 0
  }, [latitude, longitude])

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const activeDrag = drag.current
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return
    drag.current = null
    motion.current.dragging = false
    setIsDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (activeDrag.moved) onDrag()
  }

  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now(), width: rect.width, height: rect.height, moved: false }
    motion.current.dragging = true
    motion.current.target = undefined
    motion.current.velocityYaw = 0
    motion.current.velocityPitch = 0
    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const activeDrag = drag.current
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return
    event.preventDefault()
    const time = performance.now()
    const dt = clamp((time - activeDrag.time) / 1000, 0.008, 0.06)
    const dx = event.clientX - activeDrag.x
    const dy = event.clientY - activeDrag.y
    const yawDelta = (dx / activeDrag.width) * Math.PI * 2
    const pitchDelta = (dy / activeDrag.height) * Math.PI * 1.15
    const state = motion.current
    state.yaw += yawDelta
    const nextPitch = state.pitch + pitchDelta
    state.pitch = clamp(nextPitch, -MAX_PITCH, MAX_PITCH)
    state.velocityYaw = clamp(state.velocityYaw * 0.25 + (yawDelta / dt) * 0.75, -10, 10)
    state.velocityPitch = state.pitch === nextPitch ? clamp(state.velocityPitch * 0.25 + (pitchDelta / dt) * 0.75, -7, 7) : 0
    activeDrag.moved ||= Math.abs(dx) + Math.abs(dy) > 2
    activeDrag.x = event.clientX
    activeDrag.y = event.clientY
    activeDrag.time = time
  }

  const keyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const nudges: Record<string, [number, number]> = {
      ArrowLeft: [-0.18, 0], ArrowRight: [0.18, 0], ArrowUp: [0, -0.13], ArrowDown: [0, 0.13],
    }
    const nudge = nudges[event.key]
    if (!nudge) return
    event.preventDefault()
    const state = motion.current
    state.target = undefined
    state.yaw += nudge[0]
    state.pitch = clamp(state.pitch + nudge[1], -MAX_PITCH, MAX_PITCH)
    state.velocityYaw = nudge[0] * 5
    state.velocityPitch = nudge[1] * 5
  }

  return <div className={`god-eye-globe ${isDragging ? 'is-dragging' : ''}`}>
    <div className="god-eye-globe-orbit orbit-one" /><div className="god-eye-globe-orbit orbit-two" /><div className="god-eye-globe-orbit orbit-three" />
    <Canvas camera={{ position: [0, 0, 4.55], fov: 42 }} dpr={[1, 1.75]} gl={{ alpha: true, antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }} fallback={<img className="god-eye-globe-fallback" src="/olho-de-deus-earth.png" alt="" />}>
      <ambientLight intensity={0.46} color="#bfd9ff" />
      <directionalLight position={[-3, 3, 5]} intensity={2.65} color="#fff7ec" />
      <directionalLight position={[3, -1, -2]} intensity={0.25} color="#2d81ee" />
      <Suspense fallback={null}><EarthSphere motion={motion} regions={regions} selected={selected} /></Suspense>
    </Canvas>
    <div
      className={`god-eye-globe-handle ${isDragging ? 'is-dragging' : ''}`}
      role="application"
      aria-label="Globo interativo. Arraste com o mouse ou toque para girar; use as setas do teclado para ajustar."
      tabIndex={0}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onLostPointerCapture={(event) => finishDrag(event)}
      onKeyDown={keyDown}
    />
  </div>
}

const phaseNames: Record<string, string> = {
  offline: 'Desligado', boot: 'Iniciando', dormant: 'Em espera', waking: 'Presença detectada',
  listening: 'Ouvindo', thinking: 'Processando', tooling: 'Consultando sistemas', speaking: 'Respondendo',
}

function eventCopy(name: string, params: EventParams): Pick<ObservedEvent, 'title' | 'detail'> {
  const source = String(params.source ?? '')
  switch (name) {
    case 'page_view': return { title: 'Página observada', detail: 'Jarvis · sessão atual' }
    case 'page_interaction': return { title: 'Interação na página', detail: [params.control, params.area].filter(Boolean).join(' · ') || 'Controle da interface' }
    case 'form_submit': return { title: 'Comando enviado', detail: 'Conteúdo do campo não coletado' }
    case 'form_focus': return { title: 'Campo ativado', detail: 'Valor do campo não coletado' }
    case 'assistant_state': return { title: 'Estado do Jarvis', detail: phaseNames[String(params.phase)] ?? 'Atividade atualizada' }
    case 'jarvis_request': return { title: 'Solicitação recebida', detail: source === 'voice' ? 'Entrada por voz · conteúdo privado' : 'Entrada digitada · conteúdo privado' }
    case 'scroll_depth': return { title: 'Rolagem da página', detail: `${String(params.depth ?? 0)}% da área percorrida` }
    case 'visibility_change': return { title: 'Visibilidade da aba', detail: params.visible ? 'Em primeiro plano' : 'Em segundo plano' }
    case 'globe_drag': return { title: 'Globo interagido', detail: 'Arrasto manual · orientação alterada' }
    case 'olho_de_deus_activated': return { title: 'Olho de Deus ativado', detail: 'Observação desta sessão iniciada' }
    case 'olho_de_deus_deactivated': return { title: 'Observação encerrada', detail: 'Eventos personalizados pausados' }
    case 'google_tag_connected': return { title: 'Google Tag conectado', detail: String(params.kind ?? 'Google tag') }
    default: return { title: 'Sinal da página', detail: name.replaceAll('_', ' ') }
  }
}

function trafficSource(): string {
  const utm = readUtmAttribution()
  if (utm.source) return utm.source
  if (!document.referrer) return 'Acesso direto'
  try {
    const host = new URL(document.referrer).hostname.replace(/^www\./, '')
    return host || 'Origem externa'
  } catch {
    return 'Origem externa'
  }
}

function HudIcon({ kind }: { kind: 'user' | 'pulse' | 'globe' | 'page' | 'screen' | 'clock' | 'network' | 'chart' }) {
  const paths = {
    user: <><circle cx="12" cy="7" r="3"/><path d="M5 20v-2a7 7 0 0 1 14 0v2Z"/></>,
    pulse: <path d="M2 12h5l3-8 4 16 3-8h5"/>,
    globe: <><circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="12" rx="4" ry="10"/><path d="M2 12h20M4 6h16M4 18h16"/></>,
    page: <><path d="M5 2h9l5 5v15H5Z"/><path d="M14 2v6h5"/></>,
    screen: <><rect x="2" y="3" width="20" height="14" rx="1"/><path d="M12 17v5M7 22h10"/></>,
    clock: <><circle cx="12" cy="13" r="9"/><path d="M12 7v6l4 2M9 1h6"/></>,
    network: <><circle cx="12" cy="4" r="3"/><circle cx="4" cy="19" r="3"/><circle cx="20" cy="19" r="3"/><path d="m10 7-4 9m8-9 4 9M7 19h10"/></>,
    chart: <path d="M3 20V12m6 8V6m6 14V9m6 11V2"/>,
  }
  return <svg className="god-eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>
}

function MiniBars({ values }: { values: number[] }) {
  return <div className="god-eye-bars" aria-hidden="true">{values.map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
}

export function OlhoDeDeus(actions: AssistantActions) {
  const utmifyStatus = useUtmifyStatus()
  const attribution = readUtmAttribution()
  const business = useStore((state) => state.businessSnapshot)
  const phase = useStore((state) => state.phase)
  const active = useStore((state) => state.godEyeActive)
  const setActive = useStore((state) => state.setGodEyeActive)
  const [tagId, setTagId] = useState(readGoogleTagId)
  const [tagStatus, setTagStatus] = useState<TagStatus>('not-configured')
  const [tagMessage, setTagMessage] = useState('Insira seu ID para enviar eventos ao Google.')
  const [draftTagId, setDraftTagId] = useState(readGoogleTagId)
  const [draft, setDraft] = useState('')
  const [events, setEvents] = useState<ObservedEvent[]>([])
  const [eventCount, setEventCount] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const origin = trafficSource()
  const [currentPhase, setCurrentPhase] = useState(() => useStore.getState().phase)
  const activeRef = useRef(false)
  const sequence = useRef(0)
  const eventTimes = useRef<number[]>([])
  const tagRequest = useRef(0)
  const [analyticsRevision, setAnalyticsRevision] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null)
  const { snapshot: analytics, error: analyticsError } = useLiveAnalytics(active, analyticsRevision)
  const live = analytics?.status === 'connected' && !analyticsError && analytics.fetchedAt != null && now - analytics.fetchedAt < 45_000
  const regions = live ? analytics.regions : []
  const selectedRegion = regions.find(region => region.id === selectedRegionId) ?? regions[0]
  const count = live ? analytics.activeUsers?.toLocaleString('pt-BR') ?? '—' : '—'
  const analyticsMessage = analyticsError ?? analytics?.message ?? 'Consultando a conexão com o Google Analytics…'

  activeRef.current = active

  const recordEvent = useCallback((name: string, params: EventParams = {}) => {
    const at = Date.now()
    const { title, detail } = eventCopy(name, params)
    const item = { id: ++sequence.current, name, title, detail, at }
    eventTimes.current = [...eventTimes.current.filter((time) => at - time < 300_000), at]
    setEvents((current) => [...current.slice(-59), item])
    setEventCount((count) => count + 1)
    sendGoogleTagEvent(name, params)
  }, [])

  const close = useCallback((source: 'voice' | 'button' | 'escape' = 'button') => {
    if (activeRef.current) recordEvent('olho_de_deus_deactivated', { source })
    pauseGoogleTagEvents()
    setActive(false)
  }, [recordEvent])

  useEffect(() => {
    const onToggle = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<{ active: boolean }>
      if (event.detail?.active) {
        setActive(true)
      } else {
        close('voice')
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && activeRef.current) close('escape')
    }
    window.addEventListener('jarvis:olho-de-deus', onToggle)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('jarvis:olho-de-deus', onToggle)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [close])

  useEffect(() => {
    if (!active) return
    const id = readGoogleTagId()
    setTagId(id)
    setDraftTagId(id)
    setEvents([])
    setEventCount(0)
    eventTimes.current = []
    sequence.current = 0

    setTagStatus(id ? 'loading' : 'not-configured')
    setTagMessage(id ? 'Conectando ao Google Tag…' : 'Insira seu ID para enviar eventos ao Google.')
    const request = ++tagRequest.current
    const connection = id ? connectGoogleTag(id) : Promise.resolve<TagStatus>('not-configured')
    recordEvent('page_view', { page_path: window.location.pathname })
    recordEvent('olho_de_deus_activated', { source: 'command' })
    void connection.then((status) => {
      if (request !== tagRequest.current) return
      setTagStatus(status)
      setTagMessage(status === 'connected'
        ? 'Eventos da sessão estão sendo enviados.'
        : status === 'error'
          ? 'Não foi possível carregar a tag. Confira o ID e a conexão.'
          : 'Eventos registrados apenas nesta sessão.')
    })

    setCurrentPhase(useStore.getState().phase)
    const unsubscribe = useStore.subscribe((state, previous) => {
      if (state.phase === previous.phase) return
      setCurrentPhase(state.phase)
      recordEvent('assistant_state', { phase: state.phase })
    })
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('button,a,[role="button"],summary') : null
      if (!target) return
      const area = target.closest('main,header,aside,footer,section')
      recordEvent('page_interaction', {
        control: target.tagName.toLowerCase(),
        area: area?.getAttribute('aria-label') ?? area?.tagName.toLowerCase(),
      })
    }
    const submit = () => recordEvent('form_submit')
    const focus = (event: FocusEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        recordEvent('form_focus', { control: event.target.tagName.toLowerCase() })
      }
    }
    const visibility = () => recordEvent('visibility_change', { visible: document.visibilityState === 'visible' })
    const thresholds = new Set<number>()
    const scrollArea = document.querySelector('.god-eye')
    const scroll = () => {
      const area = scrollArea instanceof HTMLElement ? scrollArea : document.documentElement
      const total = area.scrollHeight - area.clientHeight
      if (total <= 0) return
      const depth = Math.min(100, Math.floor((area.scrollTop / total) * 4) * 25)
      if (depth >= 25 && !thresholds.has(depth)) {
        thresholds.add(depth)
        recordEvent('scroll_depth', { depth })
      }
    }
    const requestEvent = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<{ source?: 'voice' | 'text' }>
      recordEvent('jarvis_request', { source: event.detail?.source ?? 'voice' })
    }
    document.addEventListener('click', click, true)
    document.addEventListener('submit', submit, true)
    document.addEventListener('focusin', focus, true)
    document.addEventListener('visibilitychange', visibility)
    scrollArea?.addEventListener('scroll', scroll, { passive: true })
    window.addEventListener('jarvis:request', requestEvent)

    const timer = window.setInterval(() => {
      const current = Date.now()
      setNow(current)
      eventTimes.current = eventTimes.current.filter((time) => current - time < 300_000)
    }, 1000)

    return () => {
      tagRequest.current++
      unsubscribe()
      document.removeEventListener('click', click, true)
      document.removeEventListener('submit', submit, true)
      document.removeEventListener('focusin', focus, true)
      document.removeEventListener('visibilitychange', visibility)
      scrollArea?.removeEventListener('scroll', scroll)
      window.removeEventListener('jarvis:request', requestEvent)
      window.clearInterval(timer)
      pauseGoogleTagEvents()
    }
  }, [active, recordEvent])

  const connectTag = async (event: FormEvent) => {
    event.preventDefault()
    const id = normaliseGoogleTagId(draftTagId)
    if (!isGoogleTagId(id)) {
      setTagStatus('error')
      setTagMessage('ID inválido. Use G-..., GT-... ou GTM-...')
      return
    }
    saveGoogleTagId(id)
    setTagId(id)
    setTagStatus('loading')
    setTagMessage('Conectando ao Google Tag…')
    const request = ++tagRequest.current
    const status = await connectGoogleTag(id)
    if (request !== tagRequest.current) return
    setTagStatus(status)
    setTagMessage(status === 'connected'
      ? 'Eventos da sessão estão sendo enviados.'
      : 'Não foi possível carregar a tag. Confira o ID e a conexão.')
    if (status === 'connected') {
      const kind = id.startsWith('GTM-') ? 'Tag Manager' : 'Google tag'
      recordEvent('google_tag_connected', { kind })
      sendGoogleTagEvent('page_view', { page_path: window.location.pathname })
    }
  }

  const activityBars = useMemo(() => {
    const bins = Array.from({ length: 12 }, () => 0)
    for (const item of events) {
      const age = now - item.at
      if (age < 300_000) bins[11 - Math.min(11, Math.floor(age / 25_000))]++
    }
    const max = Math.max(...bins, 1)
    return bins.map((value) => Math.max(4, Math.round((value / max) * 100)))
  }, [events, now])

  if (!active) return null

  const stateLabel = phaseNames[currentPhase] ?? 'Ativo'
  const busy = ['thinking', 'tooling', 'speaking'].includes(phase)
  const submitCommand = (event: FormEvent) => {
    event.preventDefault()
    const command = draft.trim()
    if (!command || phase === 'boot') return
    actions.onAsk(command)
    setDraft('')
  }

  return <section className="god-eye" role="dialog" aria-modal="true" aria-labelledby="god-eye-title">
    <div className="god-eye-stars" aria-hidden="true" />
    <header className="god-eye-header">
      <div className="god-eye-brand"><i className="god-eye-live-dot" /><span>SISTEMA ONLINE · MODO ESPECIAL</span></div>
      <div className="god-eye-wordmark">J.A.R.V.I.S.<small>PERSONAL INTELLIGENCE</small></div>
      <div className="god-eye-header-meta"><time>{new Date(now).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time><span>PT-BR</span><button onClick={() => close('button')} aria-label="Fechar Olho de Deus">×</button></div>
    </header>

    <main className="god-eye-stage">
      <div className="god-eye-heading"><span className="god-eye-corner" /><h1 id="god-eye-title">OLHO DE DEUS</h1><span className="god-eye-subtitle">OBSERVABILIDADE GLOBAL</span><i /></div>

      <aside className="god-eye-metrics" aria-label="Visitantes da página de vendas">
        <section className="god-eye-metric"><span><HudIcon kind="user" />VISITANTES ATIVOS</span><strong className={live && (analytics.activeUsers ?? 0) > 0 ? 'god-eye-count-active' : ''}>{count}</strong><small>ÚLTIMOS 5 MIN <b>{live ? '● GA4' : '○ SEM LEITURA'}</b></small></section>
        <section className="god-eye-metric"><span><HudIcon kind="pulse" />EVENTOS · PÁGINA DE VENDAS</span><strong>{live ? analytics.eventCount?.toLocaleString('pt-BR') : '—'}</strong><small>GOOGLE ANALYTICS · 5 MIN</small></section>
        <section className="god-eye-origin"><span><HudIcon kind="globe" />FONTE DOS VISITANTES</span><div className="god-eye-origin-body"><i className="god-eye-origin-ring"/><div><strong>Google Analytics 4</strong><small>{analytics?.config.measurementId ?? 'G-9BY1SD6H9Z'}</small><small>{live ? 'Leitura conectada' : 'Leitura pendente'}</small><small>Atualização a cada 15 segundos</small></div></div></section>
        <section className="god-eye-data-row"><label><HudIcon kind="page" />PÁGINA MONITORADA</label><strong className="god-eye-site-name">{analytics?.config.siteUrl ? new URL(analytics.config.siteUrl).hostname.replace(/^www\./, '') : 'scriptureacademy.online'}</strong><small title={analytics?.config.pageTitle}>{analytics?.config.pageTitle || 'Todas as páginas do fluxo'}</small></section>
        <section className="god-eye-data-row"><label><HudIcon kind="screen" />VISUALIZAÇÕES · 5 MIN</label><strong>{live ? analytics.pageViews?.toLocaleString('pt-BR') : '—'}</strong></section>
        <section className="god-eye-data-row"><label><HudIcon kind="clock" />ÚLTIMA ATUALIZAÇÃO</label><strong>{analytics?.fetchedAt ? new Date(analytics.fetchedAt).toLocaleTimeString('pt-BR') : '—'} <em>{live ? 'sincronizado' : 'sem leitura'}</em></strong></section>
        <section className="god-eye-data-row"><label><HudIcon kind="pulse" />SINAL DE PRESENÇA</label><strong className="god-eye-event-name">{live ? (analytics.activeUsers ? 'Atividade detectada' : 'Sem atividade em 5 min') : 'Conectar relatórios'}</strong></section>
      </aside>

      <RotatingGlobe onDrag={() => recordEvent('globe_drag')} regions={regions} selected={selectedRegion?.id ?? null} />

      <div className={`god-eye-live-label god-eye-presence-status ${live ? 'is-connected' : 'is-pending'}`}><i className="god-eye-live-dot"/><span>{live ? 'RADAR DE VISITANTES' : 'RADAR SEM CONEXÃO'}</span><small>{live ? 'ATIVIDADE REAL DA PÁGINA DE VENDAS · GA4' : 'VINCULE A LEITURA DO GOOGLE ANALYTICS'}</small></div>

      <div className="god-eye-callout god-eye-callout-one god-eye-region-card"><span className="god-eye-callout-title"><i className={selectedRegion ? 'has-presence' : ''}/>REGIÃO MONITORADA <time>{live ? 'GA4 · 5 MIN' : 'SEM DADOS'}</time></span><strong><HudIcon kind="globe" />{selectedRegion?.name ?? 'Aguardando visitantes'}</strong>{selectedRegion ? <><div className="god-eye-region-count">{selectedRegion.activeUsers}<small>visitantes ativos</small></div><p>{selectedRegion.cities.slice(0, 3).join(' · ') || 'Cidade não informada'}</p><small>Posição aproximada do país. Arraste para explorar.</small></> : <p>{live ? 'Nenhuma região com atividade informada neste período.' : 'As regiões acendem em verde quando o Analytics informar atividade.'}</p>}</div>
      <div className="god-eye-traffic-badge"><HudIcon kind="globe" /><div>Scripture Academy<small>{live ? `${regions.length} regiões · atualização a cada 15s` : 'Página de vendas · G-9BY1SD6H9Z'}</small></div></div>
      <div className="god-eye-callout god-eye-callout-two god-eye-presence-card"><span className="god-eye-callout-title"><i className={live && (analytics.activeUsers ?? 0) > 0 ? 'has-presence' : ''}/>PRESENÇA NA PÁGINA</span><strong className="god-eye-presence-number">{count}<small>visitantes ativos · últimos 5 min</small></strong><p role="status">{live ? (analytics.activeUsers ? 'Há atividade recente na página de vendas.' : 'Nenhum visitante ativo informado pelo GA4.') : analyticsMessage}</p>{live && analytics.fetchedAt ? <small>Atualizado às {new Date(analytics.fetchedAt).toLocaleTimeString('pt-BR')} · localização aproximada</small> : <button className="god-eye-configure" onClick={() => setSettingsOpen(true)}>CONECTAR ANALYTICS ↗</button>}</div>
      <div className="god-eye-callout god-eye-callout-three god-eye-region-list"><span className="god-eye-callout-title">REGIÕES COM ATIVIDADE</span>{regions.length ? regions.slice(0, 4).map(region => <button key={region.id} className={selectedRegion?.id === region.id ? 'is-selected' : ''} onClick={() => setSelectedRegionId(region.id)}><i className="has-presence" /><span>{region.name}</span><b>{region.activeUsers}</b></button>) : <p>{live ? 'Sem regiões neste período' : 'Aguardando leitura da propriedade'}</p>}{live && analytics.unlocated > 0 && <small>{analytics.unlocated} visitantes sem localização informada</small>}</div>

      <div className="god-eye-view-label"><span>⌜</span><i className={live && regions.length ? 'has-presence' : ''} />{live ? 'VERDE · ATIVIDADE NOS ÚLTIMOS 5 MIN' : 'SEM DADOS DE PRESENÇA · CONEXÃO PENDENTE'}<span>⌟</span></div>

      <aside className="god-eye-tag-panel" aria-label="Conexão do Google Tag">
        <h2><HudIcon kind="network" />CONEXÃO DO RADAR <b>{live ? 'ONLINE' : 'PENDENTE'}</b></h2><button className="god-eye-configure" onClick={() => setSettingsOpen(true)}>CONFIGURAR PÁGINA E ANALYTICS ↗</button><p className="god-eye-analytics-message" role="status">{live ? 'Recebendo os relatórios da página de vendas.' : analyticsMessage}</p>
        <div className="god-eye-tag-status"><i className={`is-${tagStatus}`} /><span>{tagStatus === 'connected' ? 'GOOGLE TAG CONECTADO' : tagStatus === 'loading' ? 'CONECTANDO GOOGLE TAG' : tagStatus === 'error' ? 'GOOGLE TAG INDISPONÍVEL' : 'SINAIS LOCAIS ATIVOS'}</span></div>
        <details className="god-eye-tag-settings"><summary>TAG LOCAL DO JARVIS · AVANÇADO ↗</summary><form onSubmit={(event) => void connectTag(event)}>
          <p role="status">{tagMessage}</p>
          <label htmlFor="god-eye-tag-id">ID DA TAG</label>
          <div className="god-eye-tag-input"><input id="god-eye-tag-id" aria-label="ID da Google Tag" value={draftTagId} onChange={(event) => setDraftTagId(event.target.value)} placeholder="G-XXXXXXX ou GTM-XXXX" autoComplete="off" spellCheck={false}/><button type="submit" disabled={tagStatus === 'loading'} aria-label="Conectar Google Tag">↗</button></div>
        </form></details>
        {tagId && <small className="god-eye-tag-current">CONFIGURADA · {tagId}</small>}
        <div className="god-eye-tag-checks"><span><i className={utmifyStatus === 'loaded' ? 'is-on' : ''} />UTMify: {utmifyStatus === 'loaded' ? 'script carregado' : utmifyStatus === 'error' ? 'falha ao carregar' : 'carregando…'}</span><span><i className={tagStatus === 'connected' ? 'is-on' : ''} />Google Tag {tagStatus === 'connected' ? 'carregado' : 'aguardando'}</span><span><i className={live ? 'is-on' : ''} />Leitura de visitantes: {live ? 'conectada' : 'pendente'}</span><span><i className={live && regions.length ? 'is-on' : ''} />Regiões com atividade: {live ? regions.length : '—'}</span></div>
        <div className="god-eye-rate"><label>EVENTOS / MIN <small>LOCAL</small></label><strong>{events.filter((item) => now - item.at < 60_000).length}</strong><MiniBars values={activityBars} /></div>
      </aside>

      <aside className="god-eye-business"><section className="god-eye-panel"><h2><HudIcon kind="chart" />VENDAS & CAMPANHAS</h2><div className="god-eye-business-values"><div><small>RECEITA</small><strong>{business?.revenue != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: business.currency, maximumFractionDigits: 0 }).format(business.revenue) : 'R$ —'}</strong></div><div><small>ROAS</small><strong>{business?.roas != null ? `${business.roas.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}×` : '—'}</strong></div></div><span className="god-eye-pending" title={business ? `${business.source} · ${business.period}` : undefined}>{business ? `ÚLTIMA CONSULTA · ${business.period}` : 'AGUARDANDO CONSULTA UTMIFY'}</span><div className="god-eye-flatline" /></section><section className="god-eye-panel"><h2><HudIcon kind="globe" />CONTEXTO GLOBAL</h2><p><HudIcon kind="user" />Visitantes · 5 min <b>{count}</b></p><p><HudIcon kind="globe" />Países com atividade <b>{live ? regions.length : '—'}</b></p><p><HudIcon kind="network" />Google Analytics <b>{live ? 'Recebendo' : 'Pendente'}</b></p><small>Dados agregados · localização aproximada por país.</small></section></aside>
    </main>

    <form className="god-eye-command" onSubmit={submitCommand}>
      <button type="button" className="god-eye-mic" onClick={phase === 'offline' ? actions.onStart : busy ? actions.onStop : actions.onTalk} aria-label={phase === 'offline' ? 'Ativar voz do Jarvis' : busy ? 'Interromper Jarvis' : 'Falar com Jarvis'}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v4m-3 0h6"/></svg></button>
      <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={4000} placeholder="Pergunte ao Jarvis…" aria-label="Digite um comando ao Jarvis" disabled={phase === 'boot'} />
      <button type="submit" disabled={!draft.trim() || phase === 'boot'} aria-label="Enviar comando">➤</button>
    </form>
    <footer className="god-eye-footer"><div className="god-eye-intelligence-title">INTELIGÊNCIA<br/>CONTEXTUAL</div><div><HudIcon kind="globe" /><section><strong>CONTEXTO DA SESSÃO</strong><p>{eventCount.toLocaleString('pt-BR')} sinais · origem: {origin}.</p></section></div><div><HudIcon kind="network" /><section><strong>ATRIBUIÇÃO DE CAMPANHA</strong><p>{attribution.campaign || 'Aguardando acesso com parâmetros UTM.'}</p></section></div><div><HudIcon kind="pulse" /><section><strong>SINAIS EXTERNOS</strong><p>Jarvis: {stateLabel.toLowerCase()} · {live ? 'radar conectado ao GA4' : 'radar aguardando leitura GA4'}.</p></section></div></footer>
    {settingsOpen && <AnalyticsSettings config={analytics?.config} onClose={() => setSettingsOpen(false)} onSaved={() => { setSettingsOpen(false); setAnalyticsRevision(value => value + 1) }} />}
  </section>
}
