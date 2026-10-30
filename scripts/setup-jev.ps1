$ErrorActionPreference = 'Stop'
$secureJevKey = Read-Host 'Cole a chave de API oficial da TypeSafe (entrada oculta)' -AsSecureString
$jevKeyPtr = [IntPtr]::Zero
try {
  $jevKeyPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureJevKey)
  $plainJevKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($jevKeyPtr).Trim()
  if ([string]::IsNullOrWhiteSpace($plainJevKey)) { throw 'Chave vazia. Nada foi alterado.' }
  $jevConfigPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'jev.config.local'
  @{ apiKey = $plainJevKey; model = 'jev-latest' } | ConvertTo-Json | Set-Content -LiteralPath $jevConfigPath -Encoding utf8
  Write-Host 'Chave salva no backend local. Reinicie o Jarvis com npm start.'
} finally {
  if ($jevKeyPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($jevKeyPtr) }
  $plainJevKey = $null
  $secureJevKey.Dispose()
}
