import { createSign } from 'node:crypto'
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import countries from './country-centers.json' with { type: 'json' }

const DEFAULT_SITE = 'https://www.scriptureacademy.online/'
const DEFAULT_TITLE = 'The Letters of Paul — 13 Bible studies explained verse by verse'
const DEFAULT_TAG = 'G-9BY1SD6H9Z'
const TTL = 15_000
const WINDOW_MINUTES = 5
const configPath = join(homedir(), '.jarvis', 'analytics.local.json')

export function validateAnalyticsConfig(input) {
  const propertyId = String(input.propertyId ?? '').trim().replace(/^properties\//, '')
  if (propertyId && !/^\d{1,20}$/.test(propertyId)) throw new Error('Use o ID numérico da propriedade GA4, sem G-.')
  const site = new URL(input.siteUrl || DEFAULT_SITE)
  if (!['https:', 'http:'].includes(site.protocol) || site.username || site.password) throw new Error('Informe uma URL pública válida.')
  site.search = ''; site.hash = ''
  const pageTitle = String(input.pageTitle ?? DEFAULT_TITLE).trim()
  if (pageTitle.length > 300) throw new Error('Título da página muito longo.')
  const measurementId = String(input.measurementId || DEFAULT_TAG).trim().toUpperCase()
  if (!/^G-[A-Z0-9]+$/.test(measurementId)) throw new Error('Informe uma tag GA4 G- válida.')
  return { propertyId, siteUrl: site.href, pageTitle, measurementId }
}

function credentialFromEnv(env) {
  if (!env.GOOGLE_ANALYTICS_CREDENTIALS_JSON) return null
  try {
    const value = JSON.parse(env.GOOGLE_ANALYTICS_CREDENTIALS_JSON)
    if (value.type !== 'service_account' || !value.client_email || !value.private_key) return null
    return { email: value.client_email, key: value.private_key }
  } catch { return null }
}

export function normaliseRealtime(geo, totals, pages, now = Date.now()) {
  const byCountry = new Map()
  let unlocated = 0
  for (const row of geo.rows ?? []) {
    const code = row.dimensionValues?.[0]?.value
    const count = Math.max(0, Number(row.metricValues?.[0]?.value) || 0)
    if (!count) continue
    const country = countries[code]
    if (!country) { unlocated += count; continue }
    const current = byCountry.get(code) ?? { id: code, ...country, activeUsers: 0, cities: [] }
    current.activeUsers += count
    const city = row.dimensionValues?.[1]?.value
    if (city && city !== '(not set)' && !current.cities.includes(city)) current.cities.push(city)
    byCountry.set(code, current)
  }
  const metrics = totals.rows?.[0]?.metricValues ?? []
  return {
    fetchedAt: now, windowMinutes: WINDOW_MINUTES,
    activeUsers: Math.max(0, Number(metrics[0]?.value) || 0),
    eventCount: Math.max(0, Number(metrics[1]?.value) || 0),
    pageViews: Math.max(0, Number(metrics[2]?.value) || 0), unlocated,
    regions: [...byCountry.values()].sort((a, b) => b.activeUsers - a.activeUsers),
    pages: (pages.rows ?? []).map(row => ({ title: row.dimensionValues?.[0]?.value || 'Sem título', activeUsers: Number(row.metricValues?.[0]?.value) || 0 })),
  }
}

export function createAnalytics({ env = process.env, request = fetch, now = Date.now, path = configPath } = {}) {
  let saved = null
  let cached = null
  let inFlight = null
  let version = 0
  let token = null
  let streamCache = null
  const credential = credentialFromEnv(env)
  const ready = readFile(path, 'utf8').then(raw => { saved = validateAnalyticsConfig(JSON.parse(raw)) }).catch(() => {})
  const settings = () => validateAnalyticsConfig({
    ...saved,
    ...(env.GOOGLE_ANALYTICS_PROPERTY_ID ? { propertyId: env.GOOGLE_ANALYTICS_PROPERTY_ID } : {}),
    ...(env.GOOGLE_ANALYTICS_SITE_URL ? { siteUrl: env.GOOGLE_ANALYTICS_SITE_URL } : {}),
    ...(env.GOOGLE_ANALYTICS_PAGE_TITLE !== undefined ? { pageTitle: env.GOOGLE_ANALYTICS_PAGE_TITLE } : {}),
    ...(env.GOOGLE_ANALYTICS_MEASUREMENT_ID ? { measurementId: env.GOOGLE_ANALYTICS_MEASUREMENT_ID } : {}),
  })
  const publicConfig = () => ({ ...settings(), credentialReady: !!credential, readerEmail: credential?.email ?? null })

  async function accessToken() {
    if (token && token.until > now() + 60_000) return token.value
    const issued = Math.floor(now() / 1000)
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
    const message = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: credential.email, scope: 'https://www.googleapis.com/auth/analytics.readonly', aud: 'https://oauth2.googleapis.com/token', iat: issued, exp: issued + 3600 })}`
    const sign = createSign('RSA-SHA256'); sign.update(message)
    const assertion = `${message}.${sign.sign(credential.key, 'base64url')}`
    const response = await request('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }), signal: AbortSignal.timeout(10_000) })
    if (!response.ok) throw new Error('auth')
    const data = await response.json()
    if (!data.access_token) throw new Error('auth')
    token = { value: data.access_token, until: now() + (Number(data.expires_in) || 3600) * 1000 }
    return token.value
  }

  async function stream(config, bearer) {
    const key = `${config.propertyId}:${config.measurementId}:${config.siteUrl}`
    if (streamCache?.key === key && now() - streamCache.at < 300_000) return streamCache.value
    const response = await request(`https://analyticsadmin.googleapis.com/v1beta/properties/${config.propertyId}/dataStreams?pageSize=200`, { headers: { authorization: `Bearer ${bearer}` }, signal: AbortSignal.timeout(10_000) })
    if (!response.ok) throw new Error(response.status === 403 ? 'permission' : 'stream')
    const data = await response.json()
    const match = data.dataStreams?.find(item => item.webStreamData?.measurementId === config.measurementId)
    if (!match) throw new Error('tag')
    if (new URL(match.webStreamData.defaultUri).hostname.replace(/^www\./, '') !== new URL(config.siteUrl).hostname.replace(/^www\./, '')) throw new Error('site')
    const value = { id: match.name.split('/').at(-1), name: match.displayName }
    streamCache = { key, value, at: now() }
    return value
  }

  async function load() {
    const config = publicConfig()
    const base = { config, regions: [], pages: [], activeUsers: null, eventCount: null, pageViews: null, unlocated: 0, fetchedAt: null, windowMinutes: WINDOW_MINUTES }
    if (!config.propertyId || !credential) return { ...base, status: 'setup', message: !config.propertyId ? 'Vincule a propriedade GA4 para consultar os visitantes da página de vendas.' : 'Falta configurar o acesso de leitura ao Google Analytics no servidor.' }
    try {
      const bearer = await accessToken()
      const selected = await stream(config, bearer)
      const filters = [{ filter: { fieldName: 'streamId', stringFilter: { matchType: 'EXACT', value: selected.id } } }]
      if (config.pageTitle) filters.push({ filter: { fieldName: 'unifiedScreenName', stringFilter: { matchType: 'EXACT', value: config.pageTitle } } })
      const report = async (dimensions, metrics) => {
        const response = await request(`https://analyticsdata.googleapis.com/v1beta/properties/${config.propertyId}:runRealtimeReport`, { method: 'POST', headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' }, body: JSON.stringify({ dimensions: dimensions.map(name => ({ name })), metrics: metrics.map(name => ({ name })), minuteRanges: [{ startMinutesAgo: WINDOW_MINUTES - 1, endMinutesAgo: 0 }], dimensionFilter: { andGroup: { expressions: filters } }, limit: '250' }), signal: AbortSignal.timeout(10_000) })
        if (!response.ok) throw new Error(response.status === 403 ? 'permission' : 'report')
        return response.json()
      }
      const [geo, totals, pages] = await Promise.all([report(['countryId', 'city'], ['activeUsers']), report([], ['activeUsers', 'eventCount', 'screenPageViews']), report(['unifiedScreenName'], ['activeUsers'])])
      return { ...base, ...normaliseRealtime(geo, totals, pages, now()), status: 'connected', streamName: selected.name, message: 'Dados reais do GA4 · atividade nos últimos 5 minutos. A localização é aproximada por país.' }
    } catch (error) {
      const messages = { auth: 'O Google recusou a credencial de leitura. Confira a conta de serviço no servidor.', permission: 'A conta de serviço precisa de permissão Leitor nesta propriedade e das APIs Analytics Data e Admin habilitadas.', tag: 'Essa propriedade não contém a tag informada. Confira o ID numérico da propriedade.', site: 'A tag encontrada pertence a outro domínio. Confira o fluxo da página de vendas.', stream: 'Não foi possível verificar o fluxo da tag no Google Analytics.', report: 'O Google não retornou o relatório em tempo real. Tente novamente.' }
      return { ...base, status: 'error', message: messages[error.message] ?? 'Não foi possível atualizar o Analytics. Tente novamente em alguns segundos.' }
    }
  }

  return {
    async snapshot() {
      await ready
      if (cached && now() - cached.at < TTL) return cached.value
      if (!inFlight) {
        const generation = version
        inFlight = load().then(value => { if (generation === version) cached = { at: now(), value }; return value }).finally(() => { inFlight = null })
      }
      const generation = version
      const result = await inFlight
      return generation === version && cached ? result : this.snapshot()
    },
    async configure(input) {
      await ready
      const config = validateAnalyticsConfig(input)
      await mkdir(join(path, '..'), { recursive: true })
      await writeFile(`${path}.tmp`, JSON.stringify(config), { mode: 0o600 })
      await rename(`${path}.tmp`, path)
      saved = config; version++; cached = null; streamCache = null
      return publicConfig()
    },
  }
}
