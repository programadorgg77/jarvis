# Jarvis no Render Free

O Dockerfile compila o painel e executa o bridge, incluindo a voz Antonio neural pt-BR. O modo hospedado exige usuario e senha e protege HTTP e WebSocket. A origem HTTPS e lida automaticamente de RENDER_EXTERNAL_URL e a porta de PORT.

No painel Render, crie um Web Service conectado ao repositorio privado, selecione Docker e o plano Free. Deixe o Docker Command vazio e configure o healthcheck em /ready.

Variaveis de runtime:

- JARVIS_ACCESS_USER: usuario do site.
- JARVIS_ACCESS_PASSWORD: senha exclusiva de pelo menos 12 caracteres.
- CLAUDE_CODE_OAUTH_TOKEN: token da assinatura Claude do proprietario, gerado por claude setup-token. Configure diretamente no painel, sem salvar no Git.
- UTMIFY_MCP_URL: URL completa do conector MCP da UTMify que sera consultada.
- TYPESAFE_API_KEY e ELEVENLABS_API_KEY: opcionais. Sem ElevenLabs, usa a voz neural incluida.

Nenhuma credencial recebe prefixo VITE_. Nao copie configuracoes pessoais do computador para o repositorio. Sem credencial Claude, o painel e o login podem iniciar, mas perguntas a IA ainda nao funcionam.

O plano Free possui 512 MB RAM e 0,1 CPU. O servico dorme depois de 15 minutos sem trafego; abrir apos o repouso pode demorar cerca de um minuto. Os arquivos escritos em execucao nao persistem nos reinicios. Sessoes de acesso ficam em memoria e exigem novo login apos reinicio.

O uso completo com o processo Claude deve ser validado na instancia gratuita antes de afirmar estabilidade. Se os recursos forem insuficientes, nao altere para um plano pago automaticamente. O token Claude utiliza os limites da conta conectada. Configurar uma chave ANTHROPIC_API_KEY e uma alternativa com cobranca separada e nao e necessario para usar o token da assinatura.

Referencias: https://render.com/docs/free, https://render.com/docs/docker e https://render.com/docs/environment-variables.
