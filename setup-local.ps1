[CmdletBinding()]
param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$templatePath = Join-Path $repoRoot 'HueSTD_Backend\HueSTD.API\appsettings.json'
$developmentPath = Join-Path $repoRoot 'HueSTD_Backend\HueSTD.API\appsettings.Development.json'

if (-not (Test-Path $templatePath)) {
    throw "Template file not found: $templatePath"
}

if ((Test-Path $developmentPath) -and -not $Force) {
    Write-Host "Skipped: appsettings.Development.json already exists." -ForegroundColor Yellow
    Write-Host "Use '.\setup-local.ps1 -Force' to overwrite it from the template." -ForegroundColor Yellow
    exit 0
}

Copy-Item -Path $templatePath -Destination $developmentPath -Force

Write-Host "Created: $developmentPath" -ForegroundColor Green
Write-Host "Next step: fill in local Supabase and AI keys in appsettings.Development.json." -ForegroundColor Cyan
