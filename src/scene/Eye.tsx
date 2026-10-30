import { memo, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useStore } from '../store'

const vertex = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

// Both reference states are rendered in the same field. No image loop: the
// iris, flame filaments, pupil and resting glyph remain continuous at any size.
const fragment = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uAspect;
uniform float uActive;
uniform float uSpeaking;
uniform float uBlink;
uniform float uLevel;
uniform float uFlow;
uniform float uMotion;
uniform float uScale;
uniform float uIntensity;
uniform vec2 uGaze;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = .5;
  mat2 r = mat2(.8, -.6, .6, .8);
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = r * p * 2.07 + 13.2; a *= .5; }
  return v;
}
vec3 resting(vec2 p, float t) {
  // A living ribbon: bobbing, rolling and changing its projected aperture.
  // Geometry moves independently of audio so the waiting state never freezes.
  p -= vec2(sin(t * .64) * .008, sin(t * .92) * .010) * uMotion;
  float tilt = (sin(t * .68) * .13 + sin(t * .31) * .035) * uMotion;
  p = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt)) * p;
  float breathe = 1.0 + sin(t * 1.35) * .052 * uMotion;
  vec2 aperture = vec2(.190 + sin(t * .86) * .009 * uMotion, .080 + sin(t * .95 + .5) * .017 * uMotion);
  vec2 e = p / (aperture * breathe);
  float a = atan(e.y, e.x);
  float r = length(e);
  float warp = (sin(a * 3.0 - t * 1.15) * .036 + sin(a * 7.0 + t * .8) * .013) * uMotion;
  float edge = abs(r - 1.0 + warp);
  float travellingLight = pow(.5 + .5 * cos(a - t * 1.4), 12.0);
  float ring = exp(-edge * 49.0) * (2.8 + travellingLight * 2.0);
  ring += exp(-edge * 19.0) * .43 + exp(-edge * 8.0) * .055;
  ring *= .88 + .12 * sin(a - t * .5);
  float spineX = p.x + (sin(p.y * 16.0 - t * 1.5) * .012 + sin(p.y * 30.0 + t * .9) * .004) * exp(-abs(p.y) * 8.0) * uMotion;
  float taper = pow(max(0.0, 1.0 - abs(p.y) / .345), 1.2);
  float width = .0012 + .0042 * exp(-abs(p.y) * 14.0);
  float flow = .90 + .10 * sin(p.y * 27.0 - t * 3.0);
  float spine = exp(-abs(spineX) / width) * taper * 3.9 * flow;
  spine += exp(-abs(spineX) / .012) * taper * .36;
  float heart = exp(-length(p / vec2(.010,.018)) * 2.0) * .7;
  return vec3(.96,.95,1.0) * (ring + spine + heart);
}

vec3 burningEye(vec2 p, float t) {
  float frame = min(.30, uAspect * .36);
  float opening = mix(.45, 1.0, smoothstep(.05, .95, uActive)) * (1.0 - uBlink * .87);
  float voice = pow(clamp(uLevel,0.0,1.0), .65);
  // The speech envelope changes the aperture, not just its brightness. A soft
  // cadence remains when a system voice cannot expose a real audio analyser.
  float swellX = 1.0 + uMotion * (.022 * sin(t * 1.55) + uSpeaking * (.075 * voice + .024 * sin(t * 4.1)));
  float swellY = 1.0 + uMotion * (.045 * sin(t * 1.3 + .6) + uSpeaking * (.17 * voice + .075 * sin(t * 4.6) + .025 * sin(t * 8.9)));
  float roll = sin(t * .72) * .018 * uMotion;
  p = mat2(cos(roll),-sin(roll),sin(roll),cos(roll)) * p;
  vec2 q = p / vec2(frame * swellX, frame * .93 * opening * swellY);
  q -= uGaze * vec2(.06,.025);
  q.x += sin(q.y * 5.0 + t * 1.2) * .012 * (1.0 + uSpeaking) * uMotion;
  q.y += (sin(t * .8) * .014 + sin(q.x * 6.0 - t * 1.4) * .014 * uSpeaking) * uMotion;
  float r = length(q);
  if (r > 2.0) return vec3(0);
  float a = atan(q.y, q.x);
  // Angular coordinates make the filaments flow outward from the pupil.
  vec2 polar = vec2(a * 4.8, r * 3.7 - uFlow * .72);
  float n = fbm(polar);
  float fine = fbm(vec2(a * 21.0 + n * 3.0, r * 9.0 - uFlow * 1.8));
  float curl = fbm(q * 4.0 + vec2(uFlow * .16, -uFlow * .19));
  float streak = pow(max(0.0, 1.0 - abs(fine * 2.0 - 1.0)), 3.0);
  float rays = pow(fbm(vec2(a * 37.0, r * 3.1 - uFlow * 1.1)), 3.0);
  float border = .89 + (n - .5) * .38 + (fine - .5) * .12;
  float iris = smoothstep(.02,.25,r) * (1.0 - smoothstep(border - .12, border + .17, r));
  float crown = exp(-max(0.0, r - border) * (6.5 + curl * 7.0));
  crown *= smoothstep(.55,.84,r) * (.06 + streak * .85 + rays * 2.3);
  crown *= 1.0 - smoothstep(1.28, 1.78, r + n * .1);
  float threads = (.12 + fine * 1.05 + streak * .85) * iris;
  float rim = exp(-abs(r - (.81 + n * .10)) * 35.0) * (1.4 + fine * 2.5);
  float hotInner = exp(-abs(r - .42) * 7.5) * streak * 1.6;
  float heat = threads + crown + rim + hotInner;
  // Threaded electrical veins between the hot iris and the optical chassis.
  float lightning = exp(-abs(sin(a * 11.0 + fbm(vec2(a * 3.0, r * 8.0 - uFlow * .35)) * 9.0)) * 36.0);
  lightning *= smoothstep(.68, 1.03, r) * (1.0 - smoothstep(1.33, 1.68, r));
  heat += lightning * 2.3;
  heat *= .85 + uLevel * .65;
  vec3 col = vec3(1.0,.025,.001) * heat * .68;
  col += vec3(1.0,.21,.003) * pow(max(heat - .35, 0.0), 1.4) * .7;
  col += vec3(1.0,.72,.06) * pow(max(heat - 1.2, 0.0), 1.2) * .55;
  // A tall, sharply tapered pupil, with a narrow incandescent rim.
  float pupilX = q.x - uGaze.x * .20 - (sin(t * .63) * .019 + sin(t * 1.41) * .007) * uMotion;
  float pupilY = clamp(1.0 - abs(q.y - uGaze.y * .08) / .77, 0.0, 1.0);
  float dilation = 1.0 + uMotion * (.08 * sin(t * 1.7) + uSpeaking * (.2 + voice * .35));
  float slitWidth = .048 * pow(pupilY, .65) * dilation;
  float slit = (1.0 - smoothstep(slitWidth, slitWidth + .022, abs(pupilX))) * smoothstep(0.0,.12,pupilY);
  col *= 1.0 - slit * .997;
  float slitRim = exp(-abs(abs(pupilX) - slitWidth - .025) * 110.0) * pupilY;
  col += vec3(1.0,.34,.015) * slitRim * .68;
  return 1.0 - exp(-col * .85);
}
void main() {
  vec2 p = (vUv - .5) * vec2(uAspect, 1.0);
  p /= max(uScale, .2);
  float t = uTime;
  vec3 calm = resting(p, t);
  vec3 fire = burningEye(p, t);
  float blend = smoothstep(.08,.88,uActive);
  vec3 col = mix(calm,fire,blend) * uIntensity;
  gl_FragColor = vec4(col, 1.0);
}
`

function EyeField() {
  const material = useRef<THREE.ShaderMaterial>(null)
  const target = useRef(new THREE.Vector2())
  const gaze = useRef(new THREE.Vector2())
  const reduced = useRef(false)
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uFlow: { value: 0 }, uMotion: { value: 1 },
    uAspect: { value: 1 }, uActive: { value: 0 }, uSpeaking: { value: 0 }, uBlink: { value: 0 }, uLevel: { value: 0 },
    uScale: { value: 1 }, uIntensity: { value: 1 }, uGaze: { value: new THREE.Vector2() },
  }), [])
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => { reduced.current = query.matches }
    update()
    query.addEventListener('change', update)
    const pointer = (e: PointerEvent) => target.current.set((e.clientX / window.innerWidth - .5) * 2, (.5 - e.clientY / window.innerHeight) * 2)
    window.addEventListener('pointermove', pointer, { passive: true })
    return () => { query.removeEventListener('change', update); window.removeEventListener('pointermove', pointer) }
  }, [])
  useFrame((state, delta) => {
    if (!material.current) return
    const { phase, level, ui, activities } = useStore.getState()
    const active = !['offline', 'boot'].includes(phase)
    const investigating = phase === 'thinking' || phase === 'tooling'
    const u = material.current.uniforms
    const k = 1 - Math.exp(-Math.min(delta, .1) * 3.2)
    // Reduced motion softens and slows the movement instead of freezing the
    // entire visual. Voice-driven opening and closing still remains readable.
    const motion = reduced.current ? .35 : 1
    const dt = Math.min(delta, .1)
    u.uMotion.value = motion
    u.uTime.value += dt * (reduced.current ? .5 : 1)
    u.uFlow.value += dt * (reduced.current ? .35 : 1) * (1 + (investigating ? 1.1 : 0) + u.uSpeaking.value * .65 + u.uLevel.value * .25)
    const blinkCycle = u.uTime.value % 8.4
    const blink = active && !reduced.current && blinkCycle > 8.05 ? Math.sin((blinkCycle - 8.05) / .35 * Math.PI) : 0
    u.uBlink.value += (blink - u.uBlink.value) * Math.min(1, dt * 24)
    u.uAspect.value = state.size.width / state.size.height
    u.uActive.value += ((active ? 1 : 0) - u.uActive.value) * k
    u.uSpeaking.value += ((phase === 'speaking' ? 1 : 0) - u.uSpeaking.value) * k
    const envelopeSpeed = level > u.uLevel.value ? 14 : 7
    u.uLevel.value += (level - u.uLevel.value) * (1 - Math.exp(-dt * envelopeSpeed))
    u.uScale.value += (ui.reactor.scale - u.uScale.value) * k
    u.uIntensity.value += ((ui.reactor.visible ? ui.reactor.intensity : 0) - u.uIntensity.value) * k
    const working = activities.some((item) => item.status === 'running' && item.kind !== 'voice' && item.kind !== 'response')
    if (working && active) gaze.current.set(1.6 + Math.sin(u.uTime.value * 1.5) * .22 * motion, Math.sin(u.uTime.value * .8) * .12 * motion)
    else if (active) gaze.current.set(target.current.x * .35 + Math.sin(u.uTime.value * .55) * .2 * motion, target.current.y * .28 + Math.sin(u.uTime.value * .7) * .07 * motion)
    else gaze.current.copy(target.current).multiplyScalar(.65)
    u.uGaze.value.lerp(gaze.current, k * (working ? 1 : .45))
  })
  return <mesh frustumCulled={false}><planeGeometry args={[2, 2]} /><shaderMaterial ref={material} uniforms={uniforms} vertexShader={vertex} fragmentShader={fragment} depthWrite={false} depthTest={false} toneMapped={false} /></mesh>
}

export const Eye = memo(function Eye() {
  return <div className="ocular-canvas" aria-hidden="true"><Canvas gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }} dpr={[1, 1.35]} camera={{ position: [0,0,1] }}><EyeField /><EffectComposer multisampling={0}><Bloom intensity={.65} luminanceThreshold={.8} luminanceSmoothing={.5} mipmapBlur radius={.6} /></EffectComposer></Canvas></div>
})
