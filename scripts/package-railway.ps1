$ErrorActionPreference = 'Stop'
$workspacePath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$deliveryPath = Join-Path $workspacePath 'output\railway'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stagePath = Join-Path ([IO.Path]::GetTempPath()) ("Jarvis-Railway-$stamp")
New-Item -ItemType Directory -Path $stagePath, $deliveryPath -Force | Out-Null
$files = @('Dockerfile', '.dockerignore', '.railwayignore', 'railway.json', 'package.json', 'package-lock.json', 'index.html', 'vite.config.ts', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'requirements-voice.txt', 'LICENSE')
foreach ($name in $files) {
  Copy-Item -LiteralPath (Join-Path $workspacePath $name) -Destination (Join-Path $stagePath $name)
}
foreach ($name in @('src', 'bridge', 'public')) {
  $sourceRoot = Join-Path $workspacePath $name
  Get-ChildItem -LiteralPath $sourceRoot -File -Recurse | ForEach-Object {
    $relativePath = [IO.Path]::GetRelativePath($workspacePath, $_.FullName)
    if ($relativePath -match '(^|[\\/])\.|\.local$|\.log$|\.test\.mjs$|^public[\\/]mediapipe[\\/]') { return }
    $target = Join-Path $stagePath $relativePath
    New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($target)) -Force | Out-Null
    Copy-Item -LiteralPath $_.FullName -Destination $target
  }
}
New-Item -ItemType Directory -Path (Join-Path $stagePath 'scripts'), (Join-Path $stagePath 'deploy') | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'neural-voice.py') -Destination (Join-Path $stagePath 'scripts')
Copy-Item -LiteralPath (Join-Path $workspacePath 'deploy\RAILWAY.md') -Destination (Join-Path $stagePath 'deploy')
$archivePath = Join-Path $deliveryPath "Jarvis-Railway-$stamp.zip"
Compress-Archive -LiteralPath $stagePath -DestinationPath $archivePath -CompressionLevel Optimal
[IO.File]::WriteAllText((Join-Path $deliveryPath 'current-stage.local'), $stagePath)
[IO.File]::WriteAllText("$archivePath.sha256", (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash + "`n")
Write-Output "Fontes limpas: $stagePath"
Write-Output "Arquivo de implantacao: $archivePath"
