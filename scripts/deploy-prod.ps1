# Canonical production deploy for the Project Mosaic dashboard.
#
# Why this script exists: `gcloud run deploy --source .` builds whatever the
# current directory points at. If it is run from backend/ (easy to end up there
# after restarting the dev server), there is no Dockerfile, so gcloud silently
# falls back to Buildpacks and ships a backend-only image with NO built React
# frontend. This script removes that whole class of mistake:
#   - it always runs from the repo root (resolved from its own location),
#   - it refuses to deploy if the root Dockerfile is missing,
#   - it fails loudly if the build did not use the Dockerfile.
#
# Usage:  pwsh ./scripts/deploy-prod.ps1
$ErrorActionPreference = 'Stop'

$RepoRoot   = Split-Path $PSScriptRoot -Parent
$Region     = 'northamerica-northeast1'
$Service    = 'mosaic-dashboard'
$Project    = 'cio-mosaic-analytics-pr-853ae3'
$DeploySA   = 'vdi-pr-ddunga-vkasireddy@cio-mosaic-analytics-pr-853ae3.iam.gserviceaccount.com'
$TrackerGcs = 'gs://cio-mosaic-analytics-pr-853ae3-dashboard/Mosaic Customer Tracker.xlsx'

Set-Location $RepoRoot
Write-Host "Repo root: $RepoRoot"

# The root Dockerfile is the "active" build target for `--source .`. The
# exec-report deploy swaps it; restore the dashboard build here so this script
# always builds the dashboard regardless of what ran last.
if (Test-Path (Join-Path $RepoRoot 'Dockerfile.dashboard')) {
  Copy-Item (Join-Path $RepoRoot 'Dockerfile.dashboard') (Join-Path $RepoRoot 'Dockerfile') -Force
}

if (-not (Test-Path (Join-Path $RepoRoot 'Dockerfile'))) {
  throw "No Dockerfile at repo root ($RepoRoot). Refusing to deploy — would fall back to Buildpacks (backend-only, no frontend)."
}

# The deploy SA carries the Cloud Run + BigQuery permissions; durga's user
# account does not have run.developer.
Write-Host "Switching active gcloud account to the deploy SA…"
gcloud config set account $DeploySA | Out-Null

Write-Host "Deploying $Service to $Region (building from Dockerfile)…"
$envVars = "GCP_PROJECT=$Project,TRACKER_GCS=$TrackerGcs"
# --timeout=600: synchronous data-complexion rebuild can run ~3 min (>300s default).
# --clear-base-image: required after a Buildpacks deploy set an automatic base image.
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
  throw "Deploy used BUILDPACKS, not the Dockerfile — frontend was NOT built. Re-run from the repo root."
}
if ($joined -notmatch 'Building using Dockerfile') {
  Write-Warning "Could not confirm 'Building using Dockerfile' in the output — verify the revision manually."
}
if ($joined -match 'has been deployed and is serving') {
  Write-Host "`n✅ Deploy complete (Dockerfile build)." -ForegroundColor Green
} else {
  throw "Deploy did not report success — check the output above."
}
