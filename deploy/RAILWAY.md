# Jarvis no Railway

O painel compilado, a conversa por WebSocket e a voz neural rodam em um unico servico Docker. O dominio HTTPS e terminado pelo Railway. O visual existente e mantido. A versao Windows continua funcionando localmente.

## Variaveis do servico (Runtime)

| Variavel | Valor |
| --- | --- |
| `JARVIS_ACCESS_USER` | Usuario escolhido para acesso ao site |
| `JARVIS_ACCESS_PASSWORD` | Senha exclusiva, com pelo menos 12 caracteres |
| `RAILWAY_PUBLIC_DOMAIN` | Preenchida pelo Railway ao gerar um dominio publico |
| `JARVIS_PUBLIC_URL` | Opcional: origem HTTPS completa para dominio proprio; tem prioridade sobre a variavel anterior |
| `CLAUDE_CODE_OAUTH_TOKEN` | Token da conta Claude do proprietario, gerado por `claude setup-token` para uso sem login interativo |
| `ANTHROPIC_API_KEY` | Alternativa ao token de assinatura; API possui cobranca separada e tem prioridade se ambos estiverem definidos |
| `UTMIFY_MCP_URL` | URL MCP completa da conta UTMify que sera usada neste Jarvis |
| `TYPESAFE_API_KEY` | Opcional: Jev para classificacao de intencao |
| `ELEVENLABS_API_KEY` | Opcional; sem ela, a imagem inclui Antonio neural pt-BR |
| `JARVIS_MODEL` | Opcional; padrao atual `claude-opus-5` |

Nao e necessario preencher variaveis `VITE_*` nem uma URL WebSocket: o painel de producao usa o proprio dominio, com HTTPS/WSS. As credenciais acima nunca sao argumentos de build ou arquivos copiados da maquina do autor. O Docker define `JARVIS_DEPLOY=1`; sem dominio HTTPS e usuario/senha validos, o servico recusa iniciar.

O login gera uma sessao de oito horas, em cookie HttpOnly, Secure e SameSite=Strict. O painel, APIs, audio e WebSocket exigem essa sessao. `GET /ready` devolve apenas prontidao para o Railway; nao consulta a IA nem revela a configuracao. Sessoes sao apagadas ao reiniciar o servico; configure uma replica para este acesso pessoal.

## Publicacao

1. Entre na conta correta com `railway login`. Nao envie a senha dessa conta pelo chat.
2. Crie um projeto e servico vazio, gere um dominio publico em Networking e configure as variaveis no painel do servico. Configure a credencial Claude da conta que sera usada; nao copie `.claude.json` ou o login pessoal do autor.
3. Associe a pasta limpa de implantacao a esse servico com `railway link` e publique com `railway up`.
4. Aguarde o build e o healthcheck `/ready`. Abra o dominio HTTPS, entre com o usuario/senha do Jarvis e permita o microfone.
5. Valide uma pergunta geral, o audio e uma consulta de vendas com periodo conhecido. O login pode funcionar mesmo sem a credencial Claude: o healthcheck comprova o processo, nao uma resposta real da IA.

Para usar a assinatura Claude em ambiente sem navegador, gere o token na conta do proprietario e salve-o diretamente nas variaveis do servico. Os limites da assinatura continuam valendo. Nao configure tambem uma chave de API sem desejar que ela tenha prioridade. Documentacao: https://code.claude.com/docs/en/authentication#generate-a-long-lived-token

Railway possui seus proprios planos e limites; preparar os arquivos nao contrata plano nem torna a hospedagem gratuita. Consulte https://docs.railway.com/pricing/plans.

## Limites da versao hospedada

O servidor nao acessa automaticamente as abas, arquivos ou extensoes do PC de quem abre o site. Conectores remotos UTMify funcionam pela URL configurada no servidor; agenda e outros servicos precisam de sua propria integracao. O microfone e camera continuam dependendo da permissao no navegador do visitante. A voz neural, noticias e cotacoes usam internet.

As allowlists `.dockerignore` e `.railwayignore` excluem historico, runtimes Windows, ZIPs de entrega, credenciais e configuracoes locais. Para auditar uma publicacao, use o pacote de fontes limpas gerado especificamente para Railway; nao envie o ZIP Windows como imagem Linux.

Referencias: https://docs.railway.com/builds/dockerfiles e https://docs.railway.com/deployments/healthchecks.
