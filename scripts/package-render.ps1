$ErrorActionPreference = 'Stop'
$workspacePath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$deliveryPath = Join-Path $workspacePath 'output\render'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stagePath = Join-Path ([IO.Path]::GetTempPath()) ("Jarvis-Render-$stamp")
New-Item -ItemType Directory -Path $stagePath, $deliveryPath -Force | Out-Null
foreach ($name in @('Dockerfile', '.dockerignore', 'render.yaml', 'package.json', 'package-lock.json', 'index.html', 'vite.config.ts', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'requirements-voice.txt', 'LICENSE')) {
  Copy-Item -LiteralPath (Join-Path $workspacePath $name) -Destination (Join-Path $stagePath $name)
}
foreach ($name in @('src', 'bridge', 'public')) {
  Get-ChildItem -LiteralPath (Join-Path $workspacePath $name) -File -Recurse | ForEach-Object {
    $relativePath = [IO.Path]::GetRelativePath($workspacePath, $_.FullName)
    if ($relativePath -match '(^|[\\/])\.|\.local$|\.log$|\.test\.mjs$|^public[\\/]mediapipe[\\/]') { return }
    $target = Join-Path $stagePath $relativePath
    New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($target)) -Force | Out-Null
    Copy-Item -LiteralPath $_.FullName -Destination $target
  }
}
New-Item -ItemType Directory -Path (Join-Path $stagePath 'scripts') | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'neural-voice.py') -Destination (Join-Path $stagePath 'scripts')
Copy-Item -LiteralPath (Join-Path $workspacePath 'deploy/RENDER.md') -Destination (Join-Path $stagePath 'README.md')
[IO.File]::WriteAllText((Join-Path $stagePath '.gitignore'), "node_modules/`ndist/`n.env*`n*.local`n*.log`n__pycache__/`n.venv-voice/`n")
[IO.File]::WriteAllText((Join-Path $deliveryPath 'current-stage.local'), $stagePath)
Write-Output "Fontes limpas para Render: $stagePath"
