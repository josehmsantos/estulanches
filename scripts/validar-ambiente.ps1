$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
node scripts/validar-ambiente.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
