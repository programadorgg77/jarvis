# Register UTMify's read-only remote MCP endpoint in Claude Code's user config.
# The new token is read as a SecureString and is never printed or saved in this
# script. Claude Code stores the final URL in %USERPROFILE%\.claude.json.
$ErrorActionPreference = 'Stop'

$secureToken = Read-Host 'Cole aqui o NOVO token MCP da UTMify (a entrada fica oculta)' -AsSecureString
$tokenPtr = [IntPtr]::Zero
$plainToken = $null

try {
  $tokenPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
  $plainToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPtr)
  if ([string]::IsNullOrWhiteSpace($plainToken)) {
    throw 'Token vazio. Nenhuma configuração foi alterada.'
  }

  $configPath = Join-Path $env:USERPROFILE '.claude.json'
  if (Test-Path -LiteralPath $configPath) {
    # -AsHashtable preserves JSON properties that differ only by casing,
    # which can exist in Claude Code's project map on Windows.
    $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json -AsHashtable
  } else {
    $config = [ordered]@{}
  }

  $servers = [ordered]@{}
  if ($config.Contains('mcpServers') -and $config['mcpServers']) {
    foreach ($name in $config['mcpServers'].Keys) {
      if ($name -ne 'utmify') {
        $servers[$name] = $config['mcpServers'][$name]
      }
    }
  }

  $encodedToken = [Uri]::EscapeDataString($plainToken)
  $servers['utmify'] = [PSCustomObject]@{
    type = 'http'
    url = "https://mcp.utmify.com.br/mcp/?token=$encodedToken&resources=gs,gm,gu"
  }
  $config['mcpServers'] = $servers

  $json = ConvertTo-Json -InputObject $config -Depth 100
  $tempPath = "$configPath.jarvis.tmp"
  [IO.File]::WriteAllText($tempPath, $json, [Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $tempPath -Destination $configPath -Force
  Write-Host 'UTMify MCP salvo na configuração local do Claude Code. A chave não foi exibida.' -ForegroundColor Green
} finally {
  if ($tokenPtr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPtr)
  }
  if ($plainToken) {
    $plainToken = $null
  }
  if ($secureToken) {
    $secureToken.Dispose()
  }
}
