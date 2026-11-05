import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { mkdtemp, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createAnalytics, validateAnalyticsConfig, normaliseRealtime } from './analytics.mjs'

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
const credential = JSON.stringify({ type: 'service_account', client_email: 'test-reader@example.invalid', private_key: privateKey })
const row = (dims, metrics) => ({ dimensionValues: dims.map(value => ({ value })), metricValues: metrics.map(value => ({ value: String(value) })) })
const json = (value, status = 200) => new Response(JSON.stringify(value), { status })
async function fixture(options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'jarvis-analytics-test-'))
  const calls = []
  let time = Date.now()
  const path = join(dir, 'analytics.local.json')
  const request = async (url, init) => {
    calls.push({ url, init })
    if (url.includes('oauth2')) return json({ access_token: 'test-token', expires_in: 3600 })
    if (url.includes('analyticsadmin')) return json({ dataStreams: [{ name: 'properties/123/dataStreams/456', displayName: 'Sales', webStreamData: { measurementId: options.tag || 'G-9BY1SD6H9Z', defaultUri: options.site || 'https://www.scriptureacademy.online/' } }] })
    if (options.fail) return json({ error: 'private upstream error must not escape' }, 403)
    const query = JSON.parse(init.body)
    if (query.dimensions[0]?.name === 'countryId') return json({ rows: [row(['BR', 'São Paulo'], [2]), row(['US', 'New York'], [1]), row(['(not set)', '(not set)'], [1])] })
    if (query.dimensions[0]?.name === 'unifiedScreenName') return json({ rows: [row(['Sales page'], [4])] })
    return json({ rows: [row([], [4, 20, 8])] })
  }
  const service = createAnalytics({ path, request, now: () => time, env: options.env ?? { GOOGLE_ANALYTICS_PROPERTY_ID: '123', GOOGLE_ANALYTICS_CREDENTIALS_JSON: credential } })
  return { service, calls, path, advance: () => { time += 16_000 } }
}

test('unconfigured credentials never show zero or invent regions', async () => {
  const { service, calls } = await fixture({ env: {} })
  const data = await service.snapshot()
  assert.equal(data.status, 'setup'); assert.equal(data.activeUsers, null)
  assert.deepEqual(data.regions, []); assert.equal(calls.length, 0)
  assert.equal(data.config.siteUrl, 'https://www.scriptureacademy.online/')
})
test('real reports verify tag and domain, scope stream and exact page title, and use five minutes', async () => {
  const { service, calls } = await fixture()
  const data = await service.snapshot()
  assert.equal(data.status, 'connected'); assert.equal(data.activeUsers, 4)
  assert.equal(data.regions[0].id, 'BR'); assert.equal(data.regions[0].activeUsers, 2)
  assert.equal(data.unlocated, 1)
  assert.equal(data.windowMinutes, 5)
  for (const call of calls.filter(call => call.url.includes('runRealtimeReport'))) {
    const query = JSON.parse(call.init.body)
    assert.deepEqual(query.minuteRanges, [{ startMinutesAgo: 4, endMinutesAgo: 0 }])
    assert.equal(query.dimensionFilter.andGroup.expressions[0].filter.stringFilter.value, '456')
    assert.equal(query.dimensionFilter.andGroup.expressions[1].filter.fieldName, 'unifiedScreenName')
    assert.match(query.dimensionFilter.andGroup.expressions[1].filter.stringFilter.value, /The Letters of Paul/)
  }
  const assertion = new URLSearchParams(calls[0].init.body).get('assertion')
  assert.equal(JSON.parse(Buffer.from(assertion.split('.')[1], 'base64url').toString()).scope, 'https://www.googleapis.com/auth/analytics.readonly')
  assert.ok(!JSON.stringify(data).includes('PRIVATE KEY')); assert.ok(!JSON.stringify(data).includes('test-token'))
})
test('simultaneous dashboards share requests and fifteen-second cache', async () => {
  const { service, calls, advance } = await fixture()
  await Promise.all([service.snapshot(), service.snapshot(), service.snapshot()])
  assert.equal(calls.length, 5)
  await service.snapshot(); assert.equal(calls.length, 5)
  advance(); await service.snapshot(); assert.equal(calls.length, 8)
})
test('wrong tag or domain never displays visitors from another site', async () => {
  for (const option of [{ tag: 'G-WRONG' }, { site: 'https://other.example/' }]) {
    const { service, calls } = await fixture(option)
    const data = await service.snapshot()
    assert.equal(data.status, 'error'); assert.equal(data.activeUsers, null)
    assert.equal(calls.filter(call => call.url.includes('runRealtimeReport')).length, 0)
  }
})
test('denied reports return actionable errors without private upstream details', async () => {
  const { service } = await fixture({ fail: true })
  const data = await service.snapshot()
  assert.equal(data.status, 'error'); assert.match(data.message, /Leitor/)
  assert.equal(data.activeUsers, null); assert.deepEqual(data.regions, [])
  assert.ok(!JSON.stringify(data).includes('private upstream'))
})
test('empty successful report means zero; unknown locations do not get guessed coordinates', () => {
  const empty = normaliseRealtime({}, {}, {})
  assert.equal(empty.activeUsers, 0); assert.deepEqual(empty.regions, [])
  const unknown = normaliseRealtime({ rows: [row(['ZZ', 'Unknown'], [3])] }, { rows: [row([], [3, 5, 4])] }, {})
  assert.equal(unknown.unlocated, 3); assert.deepEqual(unknown.regions, [])
})
test('settings validate input, strip query strings and persist no credential', async () => {
  assert.throws(() => validateAnalyticsConfig({ propertyId: 'G-9BY1SD6H9Z' }))
  assert.throws(() => validateAnalyticsConfig({ siteUrl: 'javascript:alert(1)' }))
  assert.throws(() => validateAnalyticsConfig({ siteUrl: 'https://user:password@example.com/' }))
  const { service, path } = await fixture({ env: {} })
  await service.configure({ propertyId: '987', siteUrl: 'https://www.scriptureacademy.online/?email=private#secret', pageTitle: '' })
  const saved = JSON.parse(await readFile(path, 'utf8'))
  assert.equal(saved.siteUrl, 'https://www.scriptureacademy.online/')
  assert.equal(saved.pageTitle, ''); assert.equal(saved.propertyId, '987')
  assert.equal(Object.keys(saved).length, 4)
})
