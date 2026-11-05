import { useState, type FormEvent } from 'react'
import { saveAnalyticsConfig, type AnalyticsConfig } from '../lib/analytics'

export function AnalyticsSettings({ config, onClose, onSaved }: { config?: AnalyticsConfig; onClose: () => void; onSaved: () => void }) {
  const [propertyId, setPropertyId] = useState(config?.propertyId ?? '')
  const [siteUrl, setSiteUrl] = useState(config?.siteUrl ?? 'https://www.scriptureacademy.online/')
  const [pageTitle, setPageTitle] = useState(config?.pageTitle ?? 'The Letters of Paul — 13 Bible studies explained verse by verse')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const save = async (event: FormEvent) => {
    event.preventDefault(); setPending(true); setError('')
    try { await saveAnalyticsConfig({ propertyId, siteUrl, pageTitle, measurementId: config?.measurementId ?? 'G-9BY1SD6H9Z' }); onSaved() }
    catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível salvar.') }
    finally { setPending(false) }
  }
  return <div className="god-eye-settings-shade" onClick={onClose}>
    <section className="god-eye-settings-modal" role="dialog" aria-modal="true" aria-labelledby="analytics-settings-title" onClick={event => event.stopPropagation()} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') onClose() }}>
      <header><span>CONEXÃO DE DADOS</span><button onClick={onClose} aria-label="Fechar configurações do Analytics">×</button></header>
      <h2 id="analytics-settings-title">Sua página. Seu radar.</h2>
      <p>Vincule os relatórios da página de vendas. A tag identifica a coleta; o acesso à propriedade permite ler os visitantes.</p>
      <div className="god-eye-connection-steps"><span><b>01</b> TAG DE COLETA <strong>{config?.measurementId ?? 'G-9BY1SD6H9Z'}</strong></span><span className={config?.credentialReady ? 'is-ready' : ''}><b>02</b> ACESSO DE LEITURA <strong>{config?.credentialReady ? 'Disponível no servidor' : 'Pendente no servidor'}</strong></span></div>
      <form onSubmit={event => void save(event)}>
        <label>Propriedade do Google Analytics<input autoFocus required inputMode="numeric" pattern="[0-9]{1,20}" value={propertyId} onChange={event => setPropertyId(event.target.value)} placeholder="Ex.: 123456789" /></label>
        <small>Administrador → Detalhes da propriedade → ID da propriedade.</small>
        <label>Página de vendas<input required type="url" value={siteUrl} onChange={event => setSiteUrl(event.target.value)} /></label>
        <label>Título exato da página<input maxLength={300} value={pageTitle} onChange={event => setPageTitle(event.target.value)} /></label>
        <small>O título filtra esta página dentro do fluxo. Deixe vazio para acompanhar todo o site. O GA4 não fornece o caminho da URL neste relatório em tempo real.</small>
        <div className="god-eye-read-access"><strong>{config?.credentialReady ? 'Autorize a leitura na propriedade' : 'Acesso aos relatórios'}</strong><p>{config?.readerEmail ? <>Adicione <b>{config.readerEmail}</b> como Leitor em Administrador → Gerenciamento de acesso à propriedade.</> : 'Configure a conta de serviço do Google no servidor do Jarvis. A chave privada permanece no servidor.'}</p><small>O mapa indica atividade dos últimos 5 minutos, com localização aproximada por país. Não identifica pessoas nem confirma presença segundo a segundo.</small></div>
        {error && <p role="alert">{error}</p>}
        <button className="god-eye-configure" type="submit" disabled={pending}>{pending ? 'SALVANDO…' : 'SALVAR E VERIFICAR CONEXÃO ↗'}</button>
      </form>
    </section>
  </div>
}
