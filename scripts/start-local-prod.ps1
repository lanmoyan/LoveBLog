$env:NODE_ENV = 'production'
$env:PORT = '3100'
$env:HOSTNAME = '127.0.0.1'
$env:DATABASE_URL = 'postgresql://love_next:love_next_dev_password@localhost:5432/love_next?schema=public'
$env:UPLOAD_DIR = 'uploads'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $root

New-Item -ItemType Directory -Force -Path '.next\standalone\.next\static' | Out-Null
robocopy '.next\static' '.next\standalone\.next\static' /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
if (Test-Path 'public') { robocopy 'public' '.next\standalone\public' /MIR /NFL /NDL /NJH /NJS /NP | Out-Null }
if (Test-Path 'uploads') { robocopy 'uploads' '.next\standalone\uploads' /MIR /NFL /NDL /NJH /NJS /NP | Out-Null }

Set-Location '.next\standalone'
node server.js
