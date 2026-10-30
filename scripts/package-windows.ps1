param([string]$BuildRoot)
$ErrorActionPreference = 'Stop'
$workspacePath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$deliveryPath = Join-Path $workspacePath 'output\entrega'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
if (-not $BuildRoot) {
  $BuildRoot = Join-Path ([IO.Path]::GetTempPath()) ('Jarvis-delivery-' + [guid]::NewGuid().ToString('N'))
}
$BuildRoot = [IO.Path]::GetFullPath($BuildRoot)
$stagePath = Join-Path $BuildRoot 'Jarvis'
if (Test-Path -LiteralPath $stagePath) { throw 'A pasta temporaria de montagem ja existe.' }
New-Item -ItemType Directory -Path $stagePath -Force | Out-Null
New-Item -ItemType Directory -Path $deliveryPath -Force | Out-Null
$nodePath = (Get-Command node.exe).Source
$nodeInfo = (& $nodePath -p 'JSON.stringify({version:process.version,platform:process.platform,arch:process.arch})') | ConvertFrom-Json
if ($nodeInfo.platform -ne 'win32' -or $nodeInfo.arch -ne 'x64') { throw 'Monte este pacote com Node para Windows x64.' }

Push-Location $workspacePath
try {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar o painel.' }
} finally { Pop-Location }

# Explicit allowlist: no home configuration, credentials, source history or .env.
foreach ($name in @('LICENSE', 'Iniciar Jarvis.cmd', 'Conectar Claude.cmd', 'Conectar UTMify.cmd', 'LEIA-ME-PORTATIL.txt')) {
  Copy-Item -LiteralPath (Join-Path $workspacePath $name) -Destination (Join-Path $stagePath $name)
}
Copy-Item -LiteralPath (Join-Path $workspacePath 'dist') -Destination (Join-Path $stagePath 'dist') -Recurse
New-Item -ItemType Directory -Path (Join-Path $stagePath 'bridge'), (Join-Path $stagePath 'scripts'), (Join-Path $stagePath 'runtime') | Out-Null
Get-ChildItem -LiteralPath (Join-Path $workspacePath 'bridge') -Filter '*.mjs' -File | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $stagePath 'bridge')
}
foreach ($name in @('start-portable.mjs', 'connect-utmify.mjs', 'neural-voice.py')) {
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination (Join-Path $stagePath 'scripts')
}
Copy-Item -LiteralPath $nodePath -Destination (Join-Path $stagePath 'runtime\node.exe')
Invoke-WebRequest "https://raw.githubusercontent.com/nodejs/node/$($nodeInfo.version)/LICENSE" -OutFile (Join-Path $stagePath 'runtime\LICENSE-Node.txt')

# Only server dependencies; optional dependencies carry the Windows Claude CLI.
$sourceLock = Get-Content -LiteralPath (Join-Path $workspacePath 'package-lock.json') -Raw | ConvertFrom-Json -AsHashtable
$dependencies = [ordered]@{}
foreach ($name in @('@anthropic-ai/claude-agent-sdk', '@anthropic-ai/sdk', '@modelcontextprotocol/sdk', 'ws', 'zod', 'fast-xml-parser')) {
  $dependencies[$name] = $sourceLock.packages["node_modules/$name"].version
}
$runtimePackage = [ordered]@{ name = 'jarvis-local'; version = '1.0.0'; private = $true; type = 'module'; dependencies = $dependencies }
$runtimePackage | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $stagePath 'package.json') -Encoding utf8NoBOM
Push-Location $stagePath
try {
  & npm.cmd install --omit=dev --ignore-scripts --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao preparar dependencias portateis.' }
} finally { Pop-Location }
if (-not (Test-Path -LiteralPath (Join-Path $stagePath 'node_modules\@anthropic-ai\claude-agent-sdk-win32-x64\claude.exe'))) {
  throw 'O executavel do Claude para Windows esta ausente.'
}

$pythonVersion = '3.14.10'
$pythonZip = Join-Path $BuildRoot "python-$pythonVersion.zip"
if (-not (Test-Path -LiteralPath $pythonZip)) {
  Invoke-WebRequest "https://www.python.org/ftp/python/$pythonVersion/python-$pythonVersion-embed-amd64.zip" -OutFile $pythonZip
}
if ((Get-FileHash -LiteralPath $pythonZip -Algorithm SHA256).Hash.ToLowerInvariant() -ne '90905e64a840557d8c1bc4f5b74db3d7ee85e3ffb217611cac1c7813acea4159') {
  throw 'O hash do Python nao corresponde ao arquivo oficial.'
}
$pythonTarget = Join-Path $stagePath 'runtime\python'
Expand-Archive -LiteralPath $pythonZip -DestinationPath $pythonTarget
[IO.File]::WriteAllText((Join-Path $pythonTarget 'python314._pth'), "python314.zip`n.`nsite-packages`nimport site`n")
$buildPython = Join-Path $workspacePath '.venv-voice\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $buildPython)) { throw 'Prepare o Python de montagem com Preparar Voz.cmd.' }
$voiceDependencies = Join-Path $BuildRoot 'voice-dependencies'
& $buildPython -m pip install --disable-pip-version-check --only-binary=:all: --no-compile --target $voiceDependencies -r (Join-Path $workspacePath 'requirements-voice.txt')
if ($LASTEXITCODE -ne 0) { throw 'Falha ao preparar a voz portatil.' }
# pip's generated entry points contain the build interpreter's absolute path;
# the app calls its own script directly, so these wrappers are not distributed.
$voiceTarget = Join-Path $pythonTarget 'site-packages'
New-Item -ItemType Directory -Path $voiceTarget | Out-Null
Get-ChildItem -LiteralPath $voiceDependencies -Force | Where-Object { $_.Name -notin @('bin', '__pycache__') } | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $voiceTarget -Recurse
}
& (Join-Path $pythonTarget 'python.exe') -I -B -c 'import edge_tts; print("Voz portatil: importacao OK")'
if ($LASTEXITCODE -ne 0) { throw 'A voz portatil nao iniciou.' }

$forbidden = Get-ChildItem -LiteralPath $stagePath -File -Recurse -Force | Where-Object {
  $_.Name -match '^\.env($|\.)|^\.claude\.json$|^\.credentials\.json$|\.local$|^auth\.json$'
}
if ($forbidden) { throw 'Um arquivo de configuracao privado foi encontrado no pacote.' }
$archivePath = Join-Path $deliveryPath "Jarvis-Windows-Portatil-$stamp.zip"
Compress-Archive -LiteralPath $stagePath -DestinationPath $archivePath -CompressionLevel Optimal
$hash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
[IO.File]::WriteAllText("$archivePath.sha256", "$hash  $([IO.Path]::GetFileName($archivePath))`n")
[IO.File]::WriteAllText((Join-Path $BuildRoot 'archive-path.txt'), $archivePath)
Write-Output "Pacote criado: $archivePath"
Write-Output "Montagem temporaria: $stagePath"
Write-Output 'Painel, Node, voz e Claude incluidos. Credenciais e dados pessoais excluidos.'
