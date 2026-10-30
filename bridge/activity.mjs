/** Observable actions only. Never forward model reasoning, private arguments or tool result bodies. */
export function toolActivity(id, name, input) {
  const lower = name.toLowerCase()
  let kind = 'data', label = 'Consultando ferramenta'
  if (/get_sales_summary/.test(lower)) label = 'Conferindo faturamento na UTMify'
  else if (/get_exchange_rates/.test(lower)) label = 'Consultando referências de câmbio'
  else if (/convert_currency/.test(lower)) label = 'Convertendo moedas'
  else if (/get_news/.test(lower)) { kind = 'search'; label = 'Buscando manchetes publicadas' }
  else if (/dashboard|utmify/.test(lower)) label = 'Consultando dados da UTMify'
  else if (/^toolsearch$/i.test(name)) { kind = 'analysis'; label = 'Localizando a integração necessária' }
  else if (/search|webfetch|web_search|exa|serper/.test(lower)) { kind = 'search'; label = 'Pesquisando fontes na web' }
  else if (/chrome|browser|navigate|screenshot/.test(lower)) { kind = 'browser'; label = 'Consultando o navegador' }
  else if (/calendar|agenda/.test(lower)) label = 'Consultando a agenda'
  else if (/meta|campaign|ads/.test(lower)) label = 'Consultando campanhas'
  else if (/jarvis_ui/.test(lower)) { kind = 'response'; label = 'Atualizando o painel' }
  const source = name.startsWith('mcp__') ? name.split('__')[1].replace(/^jarvis_/, '').replace(/_/g, ' ') : name
  const periods = { today: 'Hoje', yesterday: 'Ontem', this_month: 'Este mês', last_month: 'Mês passado', last_7_days: 'Últimos 7 dias', custom: 'Período personalizado' }
  const period = periods[input?.period]
  return { id, kind, label, detail: `${source}${period ? ` · ${period}` : ''}`, status: 'running' }
}
