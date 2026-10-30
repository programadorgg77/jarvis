export type IconName = 'grid' | 'activity' | 'link' | 'arrow' | 'arrow-up' | 'mic' | 'stop' | 'send' | 'calendar' | 'trend' | 'radar' | 'mail' | 'check' | 'volume' | 'plus' | 'receipt' | 'orders' | 'people' | 'target' | 'search' | 'diamond'
const paths: Record<IconName, string> = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  activity: 'M2 12h4l3-8 5 16 3-8h5',
  link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2 M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  'arrow-up': 'M6 18 18 6 M6 6h12v12',
  mic: 'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0z M5 10v2a7 7 0 0 0 14 0v-2 M12 19v3 M8 22h8',
  stop: 'M6 6h12v12H6z',
  send: 'm4 4 17 8-17 8 3-8-3-8z M7 12h14',
  calendar: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M7 2v6 M17 2v6 M3 11h18 M7 15h3 M14 15h3',
  trend: 'm3 17 6-6 4 4 8-10 M15 5h6v6',
  radar: 'M12 3a9 9 0 1 0 9 9 M12 7a5 5 0 1 0 5 5 M12 12l8-8 M12 3v2 M3 12h2 M12 19v2 M19 12h2',
  mail: 'M3 5h18v14H3z m0 1 9 7 9-7',
  check: 'm5 12 4 4L19 6',
  volume: 'M11 4 5 9H2v6h3l6 5z M15 8a6 6 0 0 1 0 8 M18 5a10 10 0 0 1 0 14',
  plus: 'M12 5v14 M5 12h14',
  receipt: 'M5 3h14v18l-3-2-4 2-4-2-3 2V3z M8 7h8 M8 11h8 M8 15h4',
  orders: 'M3 7h18v13H3z M8 7V4h8v3 M3 11h18 M9 11v4h6v-4',
  people: 'M16 21v-3a4 4 0 0 0-8 0v3 M12 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M3 20v-3a3 3 0 0 1 3-3 M21 20v-3a3 3 0 0 0-3-3',
  target: 'M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9z M12 7a5 5 0 1 0 5 5 5 5 0 0 0-5-5z M12 10v4 M10 12h4',
  search: 'M11 3a8 8 0 1 0 8 8 8 8 0 0 0-8-8z M17 17l5 5',
  diamond: 'M12 2 22 12 12 22 2 12 12 2z M12 6l6 6-6 6-6-6 6-6z',
}
export function CommandIcon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
export function JarvisMark() {
  return <svg viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M8 6h19v16c0 6-3.6 9-9 9S9 28 9 23v-2h7v2c0 1.8.7 2.6 2 2.6s2-.8 2-2.6V13H8V6Z" fill="currentColor"/><path d="M3 6v7M3 18v5" stroke="currentColor" strokeWidth="2"/></svg>
}
