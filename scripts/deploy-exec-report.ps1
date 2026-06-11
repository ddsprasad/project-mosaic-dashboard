# Canonical production deploy for the Mosaic Analytics Executive Report.
# Separate Cloud Run service (mosaic-exec-report) -> its own URL. Reuses the
# shared backend; builds the exec-report/ frontend via Dockerfile.exec-report.
#
# Because `gcloud run deploy --source .` only auto-detects the root `Dockerfile`,
# this sets the root Dockerfile to the exec-report build for the deploy, then
# restores the dashboard build afterward (deploy-prod.ps1 also re-asserts it).
#
# Usage:  pwsh ./scripts/deploy-exec-report.ps1
$ErrorActionPreference = 'Stop'

$RepoRoot   = Split-Path $PSScriptRoot -Parent
$Region     = 'northamerica-northeast1'
$Service    = 'mosaic-exec-report'
$Project    = 'cio-mosaic-analytics-pr-853ae3'
$DeploySA   = 'vdi-pr-ddunga-vkasireddy@cio-mosaic-analytics-pr-853ae3.iam.gserviceaccount.com'
$TrackerGcs = 'gs://cio-mosaic-analytics-pr-853ae3-dashboard/Mosaic Customer Tracker.xlsx'

Set-Location $RepoRoot
Write-Host "Repo root: $RepoRoot"
if (-not (Test-Path (Join-Path $RepoRoot 'Dockerfile.exec-report'))) { throw "Dockerfile.exec-report missing." }
if (-not (Test-Path (Join-Path $RepoRoot 'exec-report'))) { throw "exec-report/ app folder missing." }

# Make the exec-report build the active root Dockerfile for `--source .`.
Copy-Item (Join-Path $RepoRoot 'Dockerfile.exec-report') (Join-Path $RepoRoot 'Dockerfile') -Force

try {
  Write-Host "Switching active gcloud account to the deploy SA…"
  gcloud config set account $DeploySA | Out-Null

  Write-Host "Deploying $Service to $Region (building from Dockerfile.exec-report)…"
  $envVars = "GCP_PROJECT=$Project,TRACKER_GCS=$TrackerGcs"
  $deployArgs = @(
    'run', 'deploy', $Service,
    '--source', '.',
    "--region=$Region",
    "--service-account=$DeploySA",
    '--no-allow-unauthenticated',
    '--timeout=600',
    '--clear-base-image',
    "--set-env-vars=$envVars",
    '--quiet'
  )
  $log = & gcloud @deployArgs 2>&1 | ForEach-Object { Write-Host $_; $_ }
  $joined = ($log -join "`n")
  if ($joined -match 'Building using Buildpacks') {
    throw "Deploy used BUILDPACKS, not the Dockerfile — frontend was NOT built."
  }
  if ($joined -match 'has been deployed and is serving') {
    Write-Host "`n✅ exec-report deploy complete (Dockerfile build)." -ForegroundColor Green
  } else {
    throw "Deploy did not report success — check the output above."
  }
}
finally {
  # Restore the dashboard build as the active root Dockerfile.
  if (Test-Path (Join-Path $RepoRoot 'Dockerfile.dashboard')) {
    Copy-Item (Join-Path $RepoRoot 'Dockerfile.dashboard') (Join-Path $RepoRoot 'Dockerfile') -Force
  }
}
