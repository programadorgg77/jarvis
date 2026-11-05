export type OfficeAction = 'work' | 'walk' | 'print' | 'coffee' | 'talk'
type Stop = { x: number; y: number; seconds: number; action: OfficeAction; paper?: boolean }

// Four independent schedules. Walk speed is 40–55 scene units per second.
const schedules: Stop[][] = [
  [{ x: 104, y: 153, seconds: 20.9, action: 'work' }, { x: 104, y: 153, seconds: 3, action: 'talk' }, { x: 104, y: 153, seconds: 12.9, action: 'work' }],
  [{ x: 307, y: 153, seconds: 6, action: 'work' }, { x: 245, y: 180, seconds: 1.6, action: 'walk' },
    { x: 68, y: 208, seconds: 3.8, action: 'walk' }, { x: 68, y: 208, seconds: 3.5, action: 'print', paper: true },
    { x: 245, y: 180, seconds: 3.8, action: 'walk', paper: true }, { x: 307, y: 153, seconds: 1.6, action: 'walk', paper: true },
    { x: 307, y: 153, seconds: 12, action: 'work' }],
  [{ x: 207, y: 232, seconds: 10, action: 'work' }, { x: 207, y: 232, seconds: 2, action: 'coffee' }, { x: 207, y: 232, seconds: 15, action: 'work' }],
  [{ x: 372, y: 228, seconds: 11, action: 'work' }, { x: 412, y: 161, seconds: 1.9, action: 'walk' },
    { x: 412, y: 161, seconds: 3, action: 'coffee' }, { x: 159, y: 180, seconds: 5, action: 'walk' },
    { x: 159, y: 180, seconds: 3, action: 'talk' }, { x: 291, y: 245, seconds: 3, action: 'walk' },
    { x: 372, y: 228, seconds: 1.9, action: 'walk' }, { x: 372, y: 228, seconds: 8, action: 'work' }],
]

const mix = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (t: number) => t * t * (3 - 2 * t)

export function officePose(worker: number, seconds: number) {
  const stops = schedules[worker]
  const total = stops.reduce((sum, stop) => sum + stop.seconds, 0)
  let elapsed = ((seconds % total) + total) % total
  let index = 0
  while (elapsed >= stops[index].seconds && index < stops.length - 1) elapsed -= stops[index++].seconds
  const stop = stops[index]
  const previous = stops[(index + stops.length - 1) % stops.length]
  const progress = elapsed / stop.seconds
  // Smooth acceleration at either end without slowing the whole walk to a crawl.
  const ramp = .12
  const travel = progress < ramp ? progress * progress / (2 * ramp * (1 - ramp))
    : progress > 1 - ramp ? 1 - (1 - progress) ** 2 / (2 * ramp * (1 - ramp))
      : (progress - ramp / 2) / (1 - ramp)
  const seat = (action: OfficeAction) => action === 'work' || (worker === 0 && action === 'talk') || (worker === 2 && action === 'coffee') ? 1 : 0
  return {
    x: mix(previous.x, stop.x, travel), y: mix(previous.y, stop.y, travel),
    seated: mix(seat(previous.action), seat(stop.action), smooth(Math.min(1, elapsed / .32))),
    walking: stop.action === 'walk' && progress > .02 && progress < .98,
    facing: (stop.action === 'walk' && stop.x < previous.x) || stop.action === 'print' || (worker === 3 && stop.action === 'coffee') ? -1 : 1,
    action: stop.action, paper: Boolean(stop.paper), elapsed,
  }
}
