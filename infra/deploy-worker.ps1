param(
  [Parameter(Mandatory = $true)][string]$ProjectId,
  [Parameter(Mandatory = $true)][string]$GeminiApiKey,
  [Parameter(Mandatory = $true)][string]$ResendApiKey,
  [Parameter(Mandatory = $true)][string]$AlertFromEmail,
  [string]$Region = "asia-northeast1",
  [string]$Repo = "mihari",
  [string]$ServiceName = "mihari-worker"
)

$Image = "$Region-docker.pkg.dev/$ProjectId/$Repo/worker"

gcloud builds submit --project $ProjectId --tag $Image ./services/worker
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

gcloud run deploy $ServiceName `
  --project $ProjectId `
  --image $Image `
  --region $Region `
  --no-allow-unauthenticated `
  --set-env-vars "GCP_PROJECT_ID=$ProjectId,GEMINI_API_KEY=$GeminiApiKey,RESEND_API_KEY=$ResendApiKey,ALERT_FROM_EMAIL=$AlertFromEmail"
