[CmdletBinding()]
param(
    [switch]$AddToPath
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    throw 'Node.js is not installed. Install Node.js 20.10 or newer from https://nodejs.org/ and run this script again.'
}

$nodeVersion = [version](node -p "process.versions.node")
if ($nodeVersion -lt [version]'20.10.0') {
    throw "Node.js $nodeVersion is too old. A11yLens needs Node.js 20.10 or newer (22+ for --render)."
}

Write-Host "Installing A11yLens dependencies in $root ..."
Push-Location $root
try {
    npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed with exit code $LASTEXITCODE." }
}
finally {
    Pop-Location
}

if ($AddToPath) {
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $parts = @($userPath -split ';' | Where-Object { $_ -and $_.Trim() })
    if ($parts -notcontains $PSScriptRoot) {
        $newPath = (@($parts) + $PSScriptRoot) -join ';'
        [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
        Write-Host "Added $PSScriptRoot to your user PATH. Open a new terminal to use it."
    }
    else {
        Write-Host "$PSScriptRoot is already on your user PATH."
    }
}

Write-Host ''
Write-Host 'A11yLens is ready.'
Write-Host ''
Write-Host 'Run it from this folder:'
Write-Host "  $PSScriptRoot\a11ylens.cmd C:\path\to\site"
Write-Host ''
Write-Host 'Or from anywhere after adding the folder to PATH:'
Write-Host '  a11ylens C:\path\to\site --render'
Write-Host ''
Write-Host 'Check the browser and axe-core setup with:'
Write-Host '  a11ylens doctor'
