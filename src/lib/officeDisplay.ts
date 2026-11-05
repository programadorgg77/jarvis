export const OFFICE_METRICS = {
  profit: 'Lucro', orders: 'Vendas', revenue: 'Faturamento', spend: 'Investimento', roas: 'ROAS',
} as const
export type OfficeMetric = keyof typeof OFFICE_METRICS
const key = 'jarvis.office.metrics'

export function readOfficeMetrics(): OfficeMetric[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (Array.isArray(saved)) {
      const valid = [...new Set(saved.filter((value): value is OfficeMetric => typeof value === 'string' && Object.hasOwn(OFFICE_METRICS, value)))].slice(0, 3)
      if (valid.length) return valid
    }
  } catch { /* Use defaults when browser storage is unavailable. */ }
  return ['profit', 'orders']
}

export function saveOfficeMetrics(metrics: OfficeMetric[]) {
  try { localStorage.setItem(key, JSON.stringify(metrics)) } catch { /* Selection remains active for this session. */ }
}

/** Only a display instruction: requests to query fresh financial data go to the assistant. */
export function officeDisplayCommand(text: string): OfficeMetric[] | null {
  const normal = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (!/\b(tela|telao|telinha|escritorio|bonequinhos)\b/.test(normal)
    || !/\b(quero|mostre|mostrar|exiba|exibir|coloque|coloca|bote|bota|apareca|aparecer|mude|mudar|troque|trocar)\b/.test(normal)
    || /\b(consulte|consultar|busque|buscar|atualize|atualizar|pesquise|puxe)\b/.test(normal)
    || /\b(nao|retire|remova|esconda|oculte|tirar|remover)\b/.test(normal)) return null
  const aliases: [OfficeMetric, RegExp][] = [
    ['profit', /\blucro\b/], ['orders', /\b(vendas|pedidos)\b/],
    ['revenue', /\b(faturamento|receita)\b/], ['spend', /\b(investimento|gastos)\b/], ['roas', /\broas\b/],
  ]
  const matches = aliases.map(([metric, pattern]) => ({ metric, index: normal.search(pattern) }))
    .filter(({ index }) => index >= 0).sort((a, b) => a.index - b.index).slice(0, 3).map(({ metric }) => metric)
  return matches.length ? matches : null
}
