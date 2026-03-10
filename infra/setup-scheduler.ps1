param(
  [Parameter(Mandatory = $true)][string]$ProjectId,
  [Parameter(Mandatory = $true)][string]$DispatcherUrl,
  [string]$Region = "asia-northeast1",
  [string]$QueueName = "mihari-monitor-jobs",
  [string]$Schedule = "*/5 * * * *"
)

gcloud tasks queues create $QueueName --project $ProjectId --location $Region 2>$null

gcloud scheduler jobs create http mihari-dispatch `
  --project $ProjectId `
  --location $Region `
  --schedule $Schedule `
  --uri "$DispatcherUrl/dispatch" `
  --http-method POST 2>$null

if ($LASTEXITCODE -ne 0) {
  gcloud scheduler jobs update http mihari-dispatch `
    --project $ProjectId `
    --location $Region `
    --schedule $Schedule `
    --uri "$DispatcherUrl/dispatch" `
    --http-method POST
}
