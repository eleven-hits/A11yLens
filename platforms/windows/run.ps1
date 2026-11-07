[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$CliArguments
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not (Test-Path (Join-Path $root 'node_modules\axe-core'))) {
    throw "A11yLens dependencies are missing. Run install.ps1 first."
}

& node (Join-Path $root 'bin\a11ylens.js') @CliArguments
exit $LASTEXITCODE
