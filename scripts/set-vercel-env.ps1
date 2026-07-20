# Lie le projet et pousse les variables d'environnement Vercel (Production + Preview + Development).
# Prérequis: `npx vercel login` puis exécuter depuis la racine du repo:
#   powershell -ExecutionPolicy Bypass -File scripts/set-vercel-env.ps1

$ErrorActionPreference = "Stop"
$Project = "v0-gwa"
$Team = "gwa"

if (-not (Test-Path ".env.local")) {
  Write-Error ".env.local introuvable — crée-le d'abord."
}

Get-Content ".env.local" | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
  if ($_ -match '^([^=]+)=(.*)$') {
    Set-Variable -Name ("ENV_" + $Matches[1].Trim()) -Value $Matches[2].Trim() -Scope Script
  }
}

$vars = @{
  "NEXT_PUBLIC_SUPABASE_URL"       = $ENV_NEXT_PUBLIC_SUPABASE_URL
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"  = $ENV_NEXT_PUBLIC_SUPABASE_ANON_KEY
  "NEXT_PUBLIC_ONESIGNAL_APP_ID"   = $ENV_NEXT_PUBLIC_ONESIGNAL_APP_ID
  "ONESIGNAL_REST_API_KEY"         = $ENV_ONESIGNAL_REST_API_KEY
  "NEXT_PUBLIC_APP_URL"            = "https://v0-gwa-mu.vercel.app"
}

Write-Host "Link projet $Project (team $Team)..."
npx vercel link --yes --project $Project --scope $Team

foreach ($name in $vars.Keys) {
  $value = $vars[$name]
  if ([string]::IsNullOrWhiteSpace($value)) {
    Write-Warning "Skip $name (vide)"
    continue
  }
  foreach ($envName in @("production", "preview", "development")) {
    Write-Host "Set $name ($envName)..."
    $value | npx vercel env add $name $envName --force --scope $Team
  }
}

Write-Host "OK — redéploie ensuite: npx vercel --prod --scope $Team"
