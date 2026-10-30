import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../store'

const schedule = [
  { time: '09:00', title: 'Planejamento da semana', meta: 'EXEMPLO · BLOCO DE FOCO' },
  { time: '13:30', title: 'Revisão de campanhas', meta: 'EXEMPLO · MARKETING' },
  { time: '16:00', title: 'Fechamento do dia', meta: 'EXEMPLO · OPERAÇÃO' },
]

const headlines = [
  { tag: 'INTELIGÊNCIA ARTIFICIAL', title: 'Fontes de notícias entram após conectar um feed ou serviço MCP.' },
  { tag: 'MERCADO', title: 'O resumo diário aparecerá aqui quando houver uma fonte ativa.' },
]

function useLocalClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

function ModuleTitle({ code, title }: { code: string; title: string }) {
  return (
    <div className="mission-module-title">
      <span className="mission-code">{code}</span>
      <h2>{title}</h2>
      <span className="mission-module-mark" aria-hidden="true">↗</span>
    </div>
  )
}

function AgendaModule() {
  return (
    <article className="mission-card mission-agenda">
      <ModuleTitle code="01 / HOJE" title="Agenda" />
      <div className="mission-agenda-list">
        {schedule.map((item, index) => (
          <div className="mission-agenda-item" key={item.time}>
            <time>{item.time}</time>
            <span className="mission-agenda-node" data-current={index === 0 ? 'true' : undefined} />
            <div>
              <strong>{item.title}</strong>
              <small>{item.meta}</small>
            </div>
          </div>
        ))}
      </div>
      <div className="mission-card-note"><span className="mission-status-dot" /> EXEMPLOS · AGENDA NÃO CONECTADA</div>
    </article>
  )
}

function PrioritiesModule() {
  return (
    <article className="mission-card mission-priorities">
      <ModuleTitle code="02 / FOCO" title="Prioridades" />
      <div className="mission-priority-list">
        <div><span className="mission-priority-index">A</span><span>Revisar resultados</span><i>EXEMPLO</i></div>
        <div><span className="mission-priority-index">B</span><span>Organizar tarefas</span><i>EXEMPLO</i></div>
        <div><span className="mission-priority-index">C</span><span>Planejar a semana</span><i>EXEMPLO</i></div>
      </div>
    </article>
  )
}

function SalesModule() {
  return (
    <article className="mission-card mission-sales">
      <ModuleTitle code="03 / PERFORMANCE" title="Vendas" />
      <div className="mission-sales-hero">
        <span>FATURAMENTO DE EXEMPLO</span>
        <strong>R$ 48.290<span>,00</span></strong>
        <small>PERÍODO SIMULADO · NÃO É DADO REAL</small>
      </div>
      <div className="mission-sales-chart" aria-label="Gráfico ilustrativo de vendas">
        <svg viewBox="0 0 320 56" role="img" aria-hidden="true">
          <defs>
            <linearGradient id="sales-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity=".28" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 45 C22 39 29 43 47 33 S75 41 94 28 S125 34 144 21 S172 31 192 19 S225 23 246 12 S278 20 320 5 V56 H0 Z" fill="url(#sales-fill)" />
          <path d="M0 45 C22 39 29 43 47 33 S75 41 94 28 S125 34 144 21 S172 31 192 19 S225 23 246 12 S278 20 320 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <span>SEG · TER · QUA · QUI · SEX · SÁB · DOM</span>
      </div>
      <div className="mission-sales-stats">
        <div><strong>128</strong><span>PEDIDOS DEMO</span></div>
        <div><strong>+12,8%</strong><span>VARIAÇÃO FICTÍCIA</span></div>
      </div>
    </article>
  )
}

function CampaignModule() {
  return (
    <article className="mission-card mission-campaigns">
      <ModuleTitle code="04 / AQUISIÇÃO" title="Mídia paga" />
      <div className="mission-campaign-source"><span>META ADS</span><b>×</b><span>UTMIFY</span><i>DEMO</i></div>
      <div className="mission-campaign-stats">
        <div><span>ROAS</span><strong>3,41×</strong></div>
        <div><span>INVESTIMENTO</span><strong>R$ 2.850</strong></div>
      </div>
      <div className="mission-card-note"><span className="mission-status-dot" /> INDICADORES ILUSTRATIVOS · SEM CONEXÃO
      </div>
    </article>
  )
}

function NewsModule() {
  return (
    <article className="mission-card mission-news">
      <ModuleTitle code="05 / RADAR" title="Notícias" />
      <div className="mission-news-list">
        {headlines.map((item, index) => (
          <div className="mission-news-item" key={item.tag}>
            <span>{item.tag} <i>DEMO {String(index + 1).padStart(2, '0')}</i></span>
            <p>{item.title}</p>
          </div>
        ))}
      </div>
      <div className="mission-card-note"><span className="mission-status-dot is-muted" /> SEM FEED AO VIVO</div>
    </article>
  )
}

export function MissionControl() {
  const now = useLocalClock()
  const connected = useStore((state) => state.connected)
  const externalCount = connected.filter((id) => !['jarvis', 'jarvis_ui', 'jarvis_chrome', 'jarvis_eyes'].includes(id.toLowerCase())).length
  const date = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).format(now).replace('.', '')
  const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(now)

  return (
    <motion.section
      className="mission-control"
      aria-label="Painel de missão demonstrativo"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
    >
      <header className="mission-topline">
        <div className="mission-topline-title"><span className="mission-crosshair" /> CENTRO DE COMANDO <i> / 01</i></div>
        <div className="mission-demo-badge"><span /> EXEMPLOS VISUAIS · SEM DADOS AO VIVO <em>· DESLIZE PARA VER MAIS ↔</em></div>
        <time className="mission-clock"><span>{date}</span><strong>{time}</strong></time>
      </header>

      <div className="mission-grid">
        <div className="mission-stack mission-stack-left">
          <AgendaModule />
          <PrioritiesModule />
        </div>

        <div className="mission-coreplate" aria-hidden="true">
          <span>NÚCLEO DE INTELIGÊNCIA</span>
          <div className="mission-core-reticle"><i /><i /><i /></div>
          <small>J.A.R.V.I.S. <b>·</b> AGUARDANDO INICIALIZAÇÃO</small>
        </div>

        <div className="mission-stack mission-stack-right">
          <SalesModule />
          <CampaignModule />
          <NewsModule />
        </div>
      </div>

      <footer className="mission-footer">
        <span>INTEGRAÇÕES: {externalCount.toString().padStart(2, '0')} ATIVAS</span>
        <span className="mission-footer-line" />
        <span>AGENDA · VENDAS · MARKETING · NOTÍCIAS</span>
        <span className="mission-footer-line" />
        <span>CONTEÚDO EXEMPLO ATÉ A CONEXÃO DAS FONTES</span>
      </footer>
    </motion.section>
  )
}
