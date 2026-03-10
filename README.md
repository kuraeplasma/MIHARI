# MIHARI MVP

MIHARI is an AI-powered website monitoring SaaS that checks:

- website uptime
- page rendering
- broken links
- contact form submission

When issues occur, MIHARI can analyze probable cause with Gemini and send deduplicated issue/recovery notifications by email.

## Architecture

Cloud Scheduler  
-> Cloud Run `dispatcher`  
-> Cloud Tasks queue  
-> Cloud Run `worker`  
-> Firestore (results + alerts)

Frontend:

- Next.js App Router (`web/`)
- Firebase Authentication (Google login only)
- Firestore-backed dashboard
- Deploys with Firebase Hosting web frameworks support

Backend services:

- `services/dispatcher`: enqueues due-site check tasks
- `services/worker`: Playwright monitor runner + Gemini + Resend

## Repository Layout

```
web/                 # Next.js frontend + API routes
services/dispatcher/ # Cloud Run task dispatcher
services/worker/     # Cloud Run Playwright worker
infra/               # Deployment helpers
firebase.json        # Firebase Hosting + Firestore config
firestore.rules
firestore.indexes.json
```

## Firestore Collections

- `users`
  - `userId`, `email`, `plan`, `createdAt`
- `sites`
  - `siteId`, `userId`, `url`, `status`, `healthScore`, `lastCheckedAt`, `nextCheckAt`, `formMonitorEnabled`, `createdAt`
- `checkJobs`
  - `jobId`, `siteId`, `userId`, `checkTypes`, `status`, `scheduledAt`, `startedAt`, `finishedAt`
- `checkResults`
  - `resultId`, `siteId`, `userId`, `uptime`, `links`, `form`, `rendering`, `aiAnalysis`, `overallStatus`, `createdAt`
- `alerts`
  - `alertId`, `siteId`, `userId`, `severity`, `type`, `title`, `message`, `resolved`, `createdAt`, `resolvedAt`

## Plan Rules

- `free`: 1 website, every 24h, form monitoring disabled, AI disabled
- `pro`: 10 websites, every 1h, form monitoring enabled, AI enabled
- `agency`: 100 websites, every 10m, form monitoring enabled, AI enabled

## Local Setup

### 1) Frontend

```bash
cd web
npm install
cp .env.example .env.local
npm run dev
```

### 2) Dispatcher

```bash
cd services/dispatcher
npm install
cp .env.example .env
npm run dev
```

### 3) Worker

```bash
cd services/worker
npm install
cp .env.example .env
npm run dev
```

## Deploy

### A) Firebase (hosting + firestore)

```bash
firebase login
firebase use <project-id>
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only hosting
```

### B) Cloud Run services

Deploy both services (or use the PowerShell scripts in `infra/`):

```bash
gcloud builds submit --tag asia-northeast1-docker.pkg.dev/<project-id>/mihari/dispatcher ./services/dispatcher
gcloud run deploy mihari-dispatcher --image asia-northeast1-docker.pkg.dev/<project-id>/mihari/dispatcher --region asia-northeast1 --allow-unauthenticated

gcloud builds submit --tag asia-northeast1-docker.pkg.dev/<project-id>/mihari/worker ./services/worker
gcloud run deploy mihari-worker --image asia-northeast1-docker.pkg.dev/<project-id>/mihari/worker --region asia-northeast1 --no-allow-unauthenticated
```

### C) Cloud Tasks + Scheduler

Create queue and scheduler job:

```bash
gcloud tasks queues create mihari-monitor-jobs --location asia-northeast1
gcloud scheduler jobs create http mihari-dispatch \
  --location asia-northeast1 \
  --schedule "*/5 * * * *" \
  --uri "https://<dispatcher-url>/dispatch" \
  --http-method POST
```

## MVP Scope Included

- website monitoring
- form monitoring
- AI error analysis
- email notifications
- dashboard UI

Not included:

- full-site crawling
- visual diff/layout detection
- auto-repair
- public ranking
- competitor monitoring
