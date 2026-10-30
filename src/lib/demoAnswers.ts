/**
 * Facts rendered by MissionControl are demonstrations, not live integrations.
 * Keep answers to questions about those visible facts available locally so
 * the dashboard can still explain itself when the remote assistant is down.
 */
const normalise = (text: string) =>
  text
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

export function answerDemoQuestion(
  question: string,
  options: { liveUtmify?: boolean } = {},
): string | null {
  const text = normalise(question)
  const explicitlyAsksForDemo =
    /\b(demo|simulacao|simulado|ficticio|demonstrativo|exemplo)\b/.test(text)

  if (/\b(faturamento|vendas?|receita)\b/.test(text)) {
    if (options.liveUtmify && !explicitlyAsksForDemo) return null
    if (/\b(como|estrategia|aumentar|melhorar|crescer|reduzir|diminuir)\b/.test(text)) {
      return null
    }
    return options.liveUtmify
      ? 'O painel mostra quarenta e oito mil duzentos e noventa reais. É um valor demonstrativo e não representa os dados reais da UTMify.'
      : 'O painel mostra quarenta e oito mil duzentos e noventa reais em faturamento. É um valor demonstrativo; nenhuma fonte de vendas está conectada.'
  }

  if (/\b(pedidos?|ordens)\b/.test(text)) {
    return 'O painel mostra cento e vinte e oito pedidos e variação fictícia de doze vírgula oito por cento. Esses números são apenas demonstração.'
  }

  if (/\b(roas|meta ads|utmify|investimento|campanha|midia paga)\b/.test(text)) {
    if (options.liveUtmify && !explicitlyAsksForDemo) return null
    return options.liveUtmify
      ? 'O painel ilustra ROAS de três vírgula quarenta e um e investimento de dois mil oitocentos e cinquenta reais. São valores fictícios; consulte a UTMify para os dados reais.'
      : 'O painel ilustra ROAS de três vírgula quarenta e um e investimento de dois mil oitocentos e cinquenta reais. São dados fictícios; Meta Ads e UTMify ainda não estão conectados.'
  }

  if (/\b(agenda|compromissos?|reunioes?)\b/.test(text)) {
    return 'A agenda demonstrativa lista planejamento às nove, revisão de campanhas às treze e trinta e fechamento do dia às dezesseis horas. Ela ainda não está conectada a uma agenda real.'
  }

  if (/\b(noticias?|manchetes?|feed)\b/.test(text)) {
    return 'O módulo de notícias está aguardando uma fonte conectada. As mensagens exibidas no painel são placeholders, não notícias ao vivo.'
  }

  return null
}
