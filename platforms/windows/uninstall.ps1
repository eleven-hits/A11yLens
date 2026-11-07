[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($userPath) {
    $parts = @($userPath -split ';' | Where-Object { $_ -and $_.Trim() -and $_ -ne $PSScriptRoot })
    [Environment]::SetEnvironmentVariable('Path', ($parts -join ';'), 'User')
    Write-Host "Removed $PSScriptRoot from your user PATH."
}
Write-Host 'The A11yLens folder was not deleted. Remove it manually if you no longer need it.'
