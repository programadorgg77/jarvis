# Radar de visitantes — Scripture Academy

A página https://www.scriptureacademy.online/ já contém a tag `G-9BY1SD6H9Z` (verificação em 05/11/2026). Instalar a tag no Jarvis coleta o uso do próprio Jarvis; não dá acesso aos visitantes da página de vendas.

O radar consulta relatórios reais do GA4, verifica a associação tag/propriedade/domínio, filtra o fluxo e o título exato da página e atualiza a cada 15 segundos. Indicadores verdes significam **atividade nos últimos cinco minutos**, não presença segundo a segundo. Regiões são países com localização aproximada no centro do país; cidades são exibidas como texto e não recebem coordenadas inventadas. Dados sem localização continuam na contagem geral. Erros, falta de acesso e dados vencidos suspendem os pulsos e mostram `—`, sem criar visitantes fictícios.

## Conectar

1. Habilitar Google Analytics Data API e Google Analytics Admin API no projeto Google Cloud.
2. Configurar uma conta de serviço. Guardar seu JSON **apenas no servidor** na variável `GOOGLE_ANALYTICS_CREDENTIALS_JSON`, nunca em variável VITE, Git ou navegador.
3. Adicionar o e-mail da conta de serviço como **Leitor** na propriedade GA4 correspondente à tag.
4. No Olho de Deus → Configurar página e Analytics, salvar o ID numérico da propriedade (Administrador → Detalhes da propriedade). A página Scripture Academy e o ID `407490537` já ficam preenchidos no Jarvis.

Alternativamente, configurar `GOOGLE_ANALYTICS_PROPERTY_ID`, `GOOGLE_ANALYTICS_SITE_URL`, `GOOGLE_ANALYTICS_PAGE_TITLE` e `GOOGLE_ANALYTICS_MEASUREMENT_ID` no servidor. Variáveis de ambiente têm prioridade. No Render, use as variáveis para persistir após substituição do contêiner; as configurações salvas pela interface ficam em `~/.jarvis/analytics.local.json` e podem ser perdidas no disco efêmero.

O título padrão é `The Letters of Paul — 13 Bible studies explained verse by verse`. Caso a página mude de título, atualize-o. Título vazio inclui todas as páginas do fluxo validado; não filtra por caminho de URL, dimensão ausente na API Realtime. Essa API não fornece identidade, IP, movimentos ou localização precisa dos visitantes. A mesma tag instalada em outras páginas pode alimentar o fluxo; a filtragem por título reduz a inclusão do painel Jarvis.

## Validação

Abrir a página de vendas e verificar no GA4 se há atividade. Depois conferir o contador no Jarvis, atualização e regiões. GA4 pode atrasar ou omitir regiões por privacidade, consentimento e bloqueadores. Os testes automatizados usam respostas simuladas, não comprovam acesso à propriedade real.

Endpoints `/analytics/realtime` e `/analytics/config` usam a proteção de login existente. Chaves e tokens não são devolvidos. A consulta usa somente o escopo `analytics.readonly`. Cache de 15 segundos compartilha consultas entre painéis.

Documentação: https://developers.google.com/analytics/devguides/reporting/data/v1/realtime-basics e https://developers.google.com/analytics/devguides/reporting/data/v1/realtime-api-schema.

Centros aproximados dos países: `world-countries` 5.1.0, dados de https://github.com/mledoze/countries (ODbL-1.0). Apenas código, centro e nome localizado são incluídos em `bridge/country-centers.json`; não há localização individual de visitantes.
