param(
  [Parameter(Mandatory = $true)][string]$ProjectId,
  [string]$Region = "asia-northeast1",
  [string]$Repo = "mihari",
  [string]$ServiceName = "mihari-dispatcher"
)

$Image = "$Region-docker.pkg.dev/$ProjectId/$Repo/dispatcher"

gcloud builds submit --project $ProjectId --tag $Image ./services/dispatcher
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

gcloud run deploy $ServiceName `
  --project $ProjectId `
  --image $Image `
  --region $Region `
  --allow-unauthenticated `
  --set-env-vars "GCP_PROJECT_ID=$ProjectId,CLOUD_TASKS_LOCATION=$Region,CLOUD_TASKS_QUEUE=mihari-monitor-jobs"
