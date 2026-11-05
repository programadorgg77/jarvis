import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'

const money = (value) => typeof value === 'number' && Number.isFinite(value) ? Math.round(value) / 100 : null
const number = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null
const day = (date) => date.toISOString().slice(0, 10)

export function businessServer(config, emit, report = () => {}) {
  let sequence = 0
  const rpc = async (name, args) => {
    if (!config?.url) throw new Error('UTMify não conectada.')
    const url = new URL(config.url)
    if (url.protocol !== 'https:' || url.hostname !== 'mcp.utmify.com.br') throw new Error('Endereço UTMify inválido.')
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...config.headers },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++sequence, method: 'tools/call', params: { name, arguments: args } }),
      signal: AbortSignal.timeout(25_000),
    })
    if (!response.ok) throw new Error(`UTMify indisponível (HTTP ${response.status}).`)
    const raw = await response.text()
    let envelope
    try { envelope = JSON.parse(raw) } catch {
      for (const event of raw.split(/\r?\n\r?\n/)) {
        const data = event.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n')
        if (data) { const candidate = JSON.parse(data); if (candidate.result || candidate.error) envelope = candidate }
      }
    }
    if (envelope?.error || envelope?.result?.isError) throw new Error('A UTMify não concluiu a consulta. Não informe valores sem confirmação.')
    const text = envelope?.result?.content?.filter((item) => item.type === 'text').map((item) => item.text).join('\n')
    if (!text) throw new Error('A UTMify não retornou dados.')
    return JSON.parse(text)
  }
  return createSdkMcpServer({ name: 'jarvis-sales', version: '1.0.0', tools: [
    tool('get_sales_summary',
      'ALWAYS use this for revenue/sales/ROAS questions. Reads UTMify, resolves the requested period in the dashboard timezone, converts ALL money from cents into currency units in code, and updates the dashboard. Returned money is already converted: NEVER divide or multiply it again. For ontem use yesterday. Never use the raw UTMify summary instead.',
      {
        period: z.enum(['today', 'yesterday', 'this_month', 'last_month', 'last_7_days', 'custom']),
        dashboardId: z.string().optional().describe('Omit when there is one dashboard. If multiple exist, ask which one.'),
        from: z.string().optional().describe('YYYY-MM-DD, only for custom'),
        to: z.string().optional().describe('YYYY-MM-DD, only for custom'),
        platforms: z.array(z.string()).max(50).optional(),
        productNames: z.array(z.string()).max(100).optional(),
        trafficSource: z.enum(['Meta', 'Google', 'Kwai', 'TikTok']).optional(),
      }, async ({ period, dashboardId, from, to, platforms, productNames, trafficSource }) => {
        let step = 'sales-dashboard'
        try {
          report({ id: step, kind: 'data', label: 'Identificando o dashboard', detail: 'Consultando a UTMify', status: 'running' })
          const dashboards = await rpc('get_dashboards', {})
          if (!Array.isArray(dashboards) || !dashboards.length) throw new Error('Nenhum dashboard UTMify disponível.')
          const dashboard = dashboardId ? dashboards.find((item) => item.id === dashboardId) : dashboards.length === 1 ? dashboards[0] : null
          if (!dashboard) {
            report({ id: step, kind: 'data', label: 'Escolha de dashboard necessária', detail: 'Há mais de uma fonte disponível', status: 'done' })
            return { content: [{ type: 'text', text: JSON.stringify({ needsDashboard: true, dashboards: dashboards.map(({ id, name }) => ({ id, name })), message: 'Pergunte ao usuário qual dashboard consultar.' }) }] }
          }
          const zone = Number(dashboard.timeZone)
          if (!Number.isFinite(zone) || zone < -12 || zone > 14) throw new Error('A fonte não informou um fuso horário válido.')
          const localDay = new Date(Date.now() + zone * 3_600_000)
          const today = day(localDay)
          let start = today, end = today
          if (period === 'yesterday') start = end = day(new Date(Date.parse(`${today}T12:00:00Z`) - 86_400_000))
          if (period === 'this_month') start = `${today.slice(0, 8)}01`
          if (period === 'last_month') {
            const previous = new Date(Date.UTC(localDay.getUTCFullYear(), localDay.getUTCMonth(), 0, 12))
            start = `${day(previous).slice(0, 8)}01`; end = day(previous)
          }
          if (period === 'last_7_days') start = day(new Date(Date.parse(`${today}T12:00:00Z`) - 6 * 86_400_000))
          if (period === 'custom') {
            const valid = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && day(new Date(`${value}T12:00:00Z`)) === value
            if (!valid(from) || !valid(to) || from > to) throw new Error('Informe um intervalo válido de datas.')
            start = from; end = to
          }
          const minutes = Math.round(Math.abs(zone) * 60)
          const offset = `${zone < 0 ? '-' : '+'}${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
          const dateRange = { from: `${start}T00:00:00${offset}`, to: `${end}T23:59:59${offset}` }
          report({ id: step, kind: 'data', label: 'Dashboard identificado', detail: `UTMify · ${dashboard.name} · ${dashboard.currency} · UTC${offset}`, status: 'done' })
          step = 'sales-period'
          report({ id: step, kind: 'data', label: 'Buscando as vendas do período', detail: `${dateRange.from} → ${dateRange.to}`, status: 'running' })
          const filters = { ...(platforms?.length ? { platforms } : {}), ...(productNames?.length ? { productNames } : {}), ...(trafficSource ? { trafficSource } : {}) }
          const raw = await rpc('get_dashboard_summary', { dashboardId: dashboard.id, dateRange, ...filters })
          report({ id: step, kind: 'data', label: 'Dados do período recebidos', detail: `${start} a ${end} · UTC${offset}`, status: 'done' })
          const revenueKind = dashboard.viewType === 'Total' ? 'gross' : 'net'
          const snapshot = {
            queryPeriod: period,
            source: `UTMify · ${dashboard.name}`, period: start === end ? start.split('-').reverse().join('/') : `${start.split('-').reverse().join('/')} – ${end.split('-').reverse().join('/')}`,
            currency: dashboard.currency, revenue: money(raw.comissions?.[revenueKind]),
            spend: money(raw.ads?.spent), orders: number(raw.ordersCount?.approved), roas: number(raw.analytics?.roas),
            profit: money(raw.analytics?.profit),
            series: [], queriedAt: new Date().toISOString(),
          }
          if (snapshot.revenue === null) throw new Error('A fonte não retornou faturamento. Não estime o valor.')
          report({ id: 'sales-units', kind: 'data', label: 'Unidades e moeda conferidas', detail: `Centavos convertidos para ${dashboard.currency} pelo código`, status: 'done' })
          emit('business', snapshot)
          const formattedRevenue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: snapshot.currency }).format(snapshot.revenue)
          const ads = (data) => Object.fromEntries(['spent', 'clicks', 'pageViews', 'initiateCheckouts', 'impressions', 'leads', 'conversations'].filter((key) => typeof data?.[key] === 'number').map((key) => [key, key === 'spent' ? money(data[key]) : number(data[key])]))
          const metrics = {
            commissions: Object.fromEntries(Object.entries(raw.comissions ?? {}).map(([key, value]) => [key, money(value)])),
            orders: Object.fromEntries(['total', 'approved', 'pending', 'refunded', 'chargedback'].map((key) => [key, number(raw.ordersCount?.[key])])),
            ads: { total: ads(raw.ads), ...Object.fromEntries(['meta', 'google', 'kwai', 'tikTok'].map((key) => [key, ads(raw.ads?.[key])])) },
            analytics: Object.fromEntries(['profit', 'taxes', 'fees', 'metaAdsTax', 'totalTaxWithMetaAdsTax', 'productsCost', 'avgTicket', 'avgCpa', 'arpu', 'customSpent', 'cpa', 'costPerConversation', 'costPerLead'].map((key) => [key, money(raw.analytics?.[key])])),
          }
          return { content: [{ type: 'text', text: JSON.stringify({ ...snapshot, formattedRevenue, revenueKind, dateRange, filters, metrics, timezone: `UTC${offset}`, unit: 'currency_units_already_converted_from_cents', note: 'Informe valor exato, moeda, período e fonte. Não arredonde para milhares. Não some receita pendente. Não faça outra conversão de unidade. initiateCheckouts é IC; os valores spent e de analytics já estão na moeda, os contadores de ads e orders são quantidades.' }) }] }
        } catch (err) {
          report({ id: step, kind: 'data', label: 'Consulta não concluída', detail: 'A fonte não confirmou os valores', status: 'error' })
          return { isError: true, content: [{ type: 'text', text: err instanceof SyntaxError ? 'A fonte retornou uma resposta ilegível. Não informe números.' : err.message }] }
        }
      }),
  ] })
}
