import express from "express";
import { Firestore } from "@google-cloud/firestore";
import { CloudTasksClient } from "@google-cloud/tasks";

interface SiteDoc {
  siteId: string;
  userId: string;
  url: string;
  formMonitorEnabled: boolean;
  nextCheckAt: string;
}

type PlanName = "free" | "pro" | "agency";

const PLAN_INTERVAL_MINUTES: Record<PlanName, number> = {
  free: 24 * 60,
  pro: 60,
  agency: 10
};

const env = {
  port: Number(process.env.PORT ?? 8080),
  projectId: process.env.GCP_PROJECT_ID ?? "",
  queueLocation: process.env.CLOUD_TASKS_LOCATION ?? "asia-northeast1",
  queueName: process.env.CLOUD_TASKS_QUEUE ?? "mihari-monitor-jobs",
  workerUrl: process.env.WORKER_URL ?? "",
  workerServiceAccountEmail: process.env.WORKER_SERVICE_ACCOUNT_EMAIL ?? "",
  batchSize: Number(process.env.BATCH_SIZE ?? 200),
  dispatcherSecret: process.env.DISPATCHER_SECRET ?? ""
};

if (!env.projectId || !env.workerUrl) {
  throw new Error("GCP_PROJECT_ID and WORKER_URL are required.");
}

const app = express();
app.use(express.json());

const firestore = new Firestore({ projectId: env.projectId });
const tasksClient = new CloudTasksClient();
const queuePath = tasksClient.queuePath(env.projectId, env.queueLocation, env.queueName);

function nowIso() {
  return new Date().toISOString();
}

function addMinutesIso(minutes: number) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function resolveIntervalMinutes(plan: PlanName | undefined) {
  if (!plan) {
    return PLAN_INTERVAL_MINUTES.free;
  }
  return PLAN_INTERVAL_MINUTES[plan] ?? PLAN_INTERVAL_MINUTES.free;
}

async function getUserPlan(userId: string, cache: Map<string, PlanName>): Promise<PlanName> {
  const cached = cache.get(userId);
  if (cached) {
    return cached;
  }

  const userSnap = await firestore.collection("users").doc(userId).get();
  const plan = (userSnap.data()?.plan ?? "free") as PlanName;
  cache.set(userId, plan);
  return plan;
}

function requireAuthorizedDispatch(req: express.Request) {
  if (!env.dispatcherSecret) {
    return;
  }

  const secret = req.header("x-mihari-secret");
  if (secret !== env.dispatcherSecret) {
    throw new Error("Unauthorized dispatcher request.");
  }
}

async function enqueueTask(payload: object) {
  const task = {
    httpRequest: {
      httpMethod: "POST" as const,
      url: `${env.workerUrl.replace(/\/$/, "")}/tasks/execute`,
      headers: {
        "Content-Type": "application/json"
      },
      body: Buffer.from(JSON.stringify(payload)).toString("base64"),
      oidcToken: env.workerServiceAccountEmail
        ? {
            serviceAccountEmail: env.workerServiceAccountEmail
          }
        : undefined
    }
  };

  await tasksClient.createTask({
    parent: queuePath,
    task
  });
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, timestamp: nowIso() });
});

app.post("/dispatch", async (req, res) => {
  try {
    requireAuthorizedDispatch(req);

    const dueSitesSnap = await firestore
      .collection("sites")
      .where("nextCheckAt", "<=", nowIso())
      .orderBy("nextCheckAt", "asc")
      .limit(env.batchSize)
      .get();

    if (dueSitesSnap.empty) {
      return res.json({ enqueued: 0, skipped: 0 });
    }

    const writeBatch = firestore.batch();
    const planCache = new Map<string, PlanName>();
    let enqueued = 0;
    let skipped = 0;

    for (const siteDoc of dueSitesSnap.docs) {
      const site = siteDoc.data() as SiteDoc;
      const plan = await getUserPlan(site.userId, planCache);
      const intervalMinutes = resolveIntervalMinutes(plan);
      const checkTypes = ["uptime", "rendering", "links"] as string[];
      if (site.formMonitorEnabled) {
        checkTypes.push("form");
      }

      const jobRef = firestore.collection("checkJobs").doc();
      const taskPayload = {
        jobId: jobRef.id,
        siteId: site.siteId,
        userId: site.userId,
        url: site.url,
        checkTypes,
        scheduledAt: nowIso()
      };

      try {
        await enqueueTask(taskPayload);
        writeBatch.set(jobRef, {
          jobId: jobRef.id,
          siteId: site.siteId,
          userId: site.userId,
          checkTypes,
          status: "queued",
          scheduledAt: taskPayload.scheduledAt,
          startedAt: null,
          finishedAt: null
        });
        writeBatch.update(siteDoc.ref, {
          nextCheckAt: addMinutesIso(intervalMinutes)
        });
        enqueued += 1;
      } catch (error) {
        skipped += 1;
        console.error("Failed to enqueue site job", site.siteId, error);
      }
    }

    await writeBatch.commit();
    return res.json({ enqueued, skipped });
  } catch (error) {
    console.error("Dispatch failed", error);
    const message = error instanceof Error ? error.message : "Dispatch failed";
    return res.status(500).json({ error: message });
  }
});

app.listen(env.port, () => {
  console.log(`mihari-dispatcher listening on :${env.port}`);
});
