import express from "express";
import { z } from "zod";
import { Firestore, QueryDocumentSnapshot } from "@google-cloud/firestore";
import { chromium, Page } from "playwright";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Resend } from "resend";

type PlanName = "free" | "pro" | "agency";
type SiteStatus = "healthy" | "degraded" | "down" | "pending";
type AlertType = "uptime" | "rendering" | "links" | "form";

const taskPayloadSchema = z.object({
  jobId: z.string().min(1),
  siteId: z.string().min(1),
  userId: z.string().min(1),
  url: z.string().url(),
  checkTypes: z.array(z.string()).default(["uptime", "rendering", "links", "form"]),
  scheduledAt: z.string().optional()
});

const env = {
  port: Number(process.env.PORT ?? 8080),
  projectId: process.env.GCP_PROJECT_ID ?? "",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  alertFromEmail: process.env.ALERT_FROM_EMAIL ?? "alerts@mihari.local",
  workerTaskSecret: process.env.WORKER_TASK_SECRET ?? "",
  timeoutMs: Number(process.env.PLAYWRIGHT_TIMEOUT_MS ?? 45_000),
  maxLinksToCheck: Number(process.env.MAX_LINKS_TO_CHECK ?? 30)
};

if (!env.projectId) {
  throw new Error("GCP_PROJECT_ID is required.");
}

interface UserDoc {
  userId: string;
  email: string;
  plan: PlanName;
}

interface AlertIssue {
  type: AlertType;
  severity: "low" | "medium" | "high";
  title: string;
  message: string;
}

interface CheckOutput {
  uptime: {
    ok: boolean;
    statusCode: number | null;
    latencyMs: number | null;
  };
  rendering: {
    ok: boolean;
    consoleErrors: string[];
  };
  links: {
    ok: boolean;
    brokenCount: number;
    checkedCount: number;
    broken: Array<{ url: string; statusCode: number | null }>;
  };
  form: {
    ok: boolean;
    status: "pass" | "fail" | "not_checked" | "captcha_detected" | "not_found";
    reason?: string;
  };
  htmlSnippet: string;
}

const firestore = new Firestore({ projectId: env.projectId });
const geminiClient = env.geminiApiKey ? new GoogleGenerativeAI(env.geminiApiKey) : null;
const resendClient = env.resendApiKey ? new Resend(env.resendApiKey) : null;

const app = express();
app.use(express.json({ limit: "1mb" }));

function nowIso() {
  return new Date().toISOString();
}

function supportsAi(plan: PlanName) {
  return plan !== "free";
}

function requireAuthorizedTask(req: express.Request) {
  if (!env.workerTaskSecret) {
    return;
  }
  const secret = req.header("x-mihari-secret");
  if (secret !== env.workerTaskSecret) {
    throw new Error("Unauthorized task request.");
  }
}

async function checkLinkStatus(url: string): Promise<number | null> {
  try {
    const head = await fetch(url, { method: "HEAD", redirect: "manual" });
    if (head.status === 405 || head.status === 501) {
      const get = await fetch(url, { method: "GET", redirect: "manual" });
      return get.status;
    }
    return head.status;
  } catch {
    return null;
  }
}

async function fillFirst(page: Page, selectors: string[], value: string) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) === 0) {
      continue;
    }
    try {
      await locator.fill(value, { timeout: 4_000 });
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

async function detectCaptcha(page: Page): Promise<boolean> {
  const selectors = [
    "iframe[src*='recaptcha']",
    "iframe[src*='hcaptcha']",
    "[id*='captcha' i]",
    "[class*='captcha' i]"
  ];
  for (const selector of selectors) {
    if ((await page.locator(selector).count()) > 0) {
      return true;
    }
  }
  return false;
}

async function runFormCheck(page: Page): Promise<CheckOutput["form"]> {
  const captchaDetected = await detectCaptcha(page);
  if (captchaDetected) {
    return {
      ok: false,
      status: "captcha_detected",
      reason: "CAPTCHA detected on contact form."
    };
  }

  const forms = await page.$$("form");
  let matched = false;
  for (const form of forms) {
    const email = await form.$("input[type='email'], input[name*='mail' i]");
    const textarea = await form.$("textarea");
    const submit = await form.$("button[type='submit'], input[type='submit'], button:not([type='button'])");
    if (!email || !textarea || !submit) {
      continue;
    }

    matched = true;
    await form.evaluate((node) => node.setAttribute("data-mihari-target", "1"));

    await fillFirst(
      page,
      [
        "form[data-mihari-target='1'] input[name*='name' i]",
        "form[data-mihari-target='1'] input[autocomplete='name']",
        "form[data-mihari-target='1'] input[type='text']"
      ],
      "MIHARI Test"
    );

    const filledEmail = await fillFirst(
      page,
      [
        "form[data-mihari-target='1'] input[type='email']",
        "form[data-mihari-target='1'] input[name*='mail' i]"
      ],
      "mihari-test@example.com"
    );

    const filledMessage = await fillFirst(
      page,
      [
        "form[data-mihari-target='1'] textarea[name*='message' i]",
        "form[data-mihari-target='1'] textarea"
      ],
      "This is a monitoring test message"
    );

    if (!filledEmail || !filledMessage) {
      return {
        ok: false,
        status: "fail",
        reason: "Required form fields could not be filled."
      };
    }

    const currentUrl = page.url();
    const navPromise = page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 12_000 }).catch(() => null);
    const responsePromise = page
      .waitForResponse((response) => response.request().method().toUpperCase() === "POST", { timeout: 12_000 })
      .catch(() => null);

    await page
      .locator(
        "form[data-mihari-target='1'] button[type='submit'], form[data-mihari-target='1'] input[type='submit'], form[data-mihari-target='1'] button:not([type='button'])"
      )
      .first()
      .click({ timeout: 8_000 });

    const [navigationResponse, submissionResponse] = await Promise.all([navPromise, responsePromise]);
    await page.waitForTimeout(1200);

    const updatedUrl = page.url();
    const bodyText = ((await page.textContent("body")) ?? "").toLowerCase();
    const successKeyword = /(thank you|success|sent|送信|ありがとうございます|完了|受け付け)/i.test(bodyText);
    const statusCode = navigationResponse?.status() ?? submissionResponse?.status() ?? null;
    const redirectOccurred = updatedUrl !== currentUrl;
    const successByHttp = statusCode === 200 || statusCode === 302;

    if (redirectOccurred || successKeyword || successByHttp) {
      return {
        ok: true,
        status: "pass"
      };
    }

    return {
      ok: false,
      status: "fail",
      reason: "Submission did not show redirect, success message, or expected HTTP status."
    };
  }

  if (!matched) {
    return {
      ok: false,
      status: "not_found",
      reason: "No contact form matching email + textarea + submit button was found."
    };
  }

  return {
    ok: false,
    status: "fail",
    reason: "Unknown form check failure."
  };
}

async function runChecks(url: string, checkTypes: string[]): Promise<CheckOutput> {
  const startedAt = Date.now();
  const consoleErrors: string[] = [];

  const output: CheckOutput = {
    uptime: {
      ok: false,
      statusCode: null,
      latencyMs: null
    },
    rendering: {
      ok: false,
      consoleErrors
    },
    links: {
      ok: false,
      brokenCount: 0,
      checkedCount: 0,
      broken: []
    },
    form: {
      ok: true,
      status: "not_checked"
    },
    htmlSnippet: ""
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(env.timeoutMs);

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text().slice(0, 280));
    }
  });

  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: env.timeoutMs });
    const status = response?.status() ?? null;
    output.uptime.statusCode = status;
    output.uptime.ok = status !== null && status >= 200 && status < 400;
    output.uptime.latencyMs = Date.now() - startedAt;

    await page.waitForSelector("body", { timeout: 12_000 });
    const bodyText = ((await page.textContent("body")) ?? "").trim();
    output.rendering.ok = bodyText.length > 32;
    output.htmlSnippet = (await page.content()).slice(0, 16_000);

    const extractedLinks = await page.evaluate((baseUrl) => {
      const urls = Array.from(document.querySelectorAll("a[href]"))
        .map((anchor) => anchor.getAttribute("href"))
        .filter((href): href is string => Boolean(href))
        .map((href) => {
          try {
            return new URL(href, baseUrl).toString();
          } catch {
            return null;
          }
        })
        .filter((href): href is string => Boolean(href))
        .filter((href) => href.startsWith("http://") || href.startsWith("https://"));

      return Array.from(new Set(urls));
    }, url);

    const selectedLinks = extractedLinks.slice(0, env.maxLinksToCheck);
    const broken: Array<{ url: string; statusCode: number | null }> = [];
    for (const link of selectedLinks) {
      const code = await checkLinkStatus(link);
      if (code === null || code >= 400) {
        broken.push({ url: link, statusCode: code });
      }
    }
    output.links.checkedCount = selectedLinks.length;
    output.links.brokenCount = broken.length;
    output.links.broken = broken;
    output.links.ok = broken.length === 0;

    if (checkTypes.includes("form")) {
      output.form = await runFormCheck(page);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown monitor error";
    output.rendering.ok = false;
    output.form = checkTypes.includes("form")
      ? {
          ok: false,
          status: "fail",
          reason: message
        }
      : output.form;
    consoleErrors.push(message);
  } finally {
    await context.close();
    await browser.close();
  }

  return output;
}

function computeHealthScore(result: CheckOutput, checkTypes: string[]): number {
  let score = 0;
  if (result.uptime.ok) {
    score += 40;
  }
  if (result.rendering.ok) {
    score += 20;
  }
  if (result.links.ok) {
    score += 20;
  }

  if (!checkTypes.includes("form") || result.form.status === "not_checked") {
    score += 20;
  } else if (result.form.ok) {
    score += 20;
  }

  return score;
}

function resolveOverallStatus(result: CheckOutput, checkTypes: string[]): SiteStatus {
  if (!result.uptime.ok) {
    return "down";
  }

  const hasIssue =
    !result.rendering.ok ||
    !result.links.ok ||
    (checkTypes.includes("form") && !result.form.ok && result.form.status !== "not_checked");

  return hasIssue ? "degraded" : "healthy";
}

async function analyzeWithGemini(input: {
  url: string;
  statusCode: number | null;
  htmlSnippet: string;
  consoleErrors: string[];
}) {
  if (!geminiClient) {
    return null;
  }

  try {
    const model = geminiClient.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
You are an SRE assistant for website monitoring.
Analyze this failed monitoring check and return only JSON:
{"cause":"short possible cause","suggestedFix":"short actionable fix"}

URL: ${input.url}
HTTP status: ${input.statusCode ?? "none"}
Console errors:
${input.consoleErrors.slice(0, 8).join("\n")}

HTML snippet:
${input.htmlSnippet.slice(0, 5000)}
`;

    const response = await model.generateContent(prompt);
    const text = response.response.text().trim();
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) {
      return {
        cause: "Automatic analysis returned non-JSON output.",
        suggestedFix: "Review server logs and browser console errors."
      };
    }

    const parsed = JSON.parse(json) as { cause?: string; suggestedFix?: string };
    return {
      cause: parsed.cause ?? "Cause not available.",
      suggestedFix: parsed.suggestedFix ?? "Fix suggestion not available."
    };
  } catch (error) {
    console.error("Gemini analysis failed", error);
    return {
      cause: "Gemini analysis failed to execute.",
      suggestedFix: "Inspect HTTP status and console errors manually."
    };
  }
}

function buildIssues(result: CheckOutput): AlertIssue[] {
  const issues: AlertIssue[] = [];

  if (!result.uptime.ok) {
    issues.push({
      type: "uptime",
      severity: "high",
      title: "Website is unreachable",
      message: `HTTP status ${result.uptime.statusCode ?? "unknown"}.`
    });
  }

  if (!result.rendering.ok) {
    issues.push({
      type: "rendering",
      severity: "medium",
      title: "Page rendering issue detected",
      message: result.rendering.consoleErrors[0] ?? "Page body did not render as expected."
    });
  }

  if (!result.links.ok) {
    issues.push({
      type: "links",
      severity: "medium",
      title: "Broken links detected",
      message: `${result.links.brokenCount} broken link(s) out of ${result.links.checkedCount} checked.`
    });
  }

  if (!result.form.ok && result.form.status !== "not_checked") {
    const severity = result.form.status === "captcha_detected" ? "low" : "medium";
    issues.push({
      type: "form",
      severity,
      title: "Contact form monitoring failed",
      message: result.form.reason ?? `Form status: ${result.form.status}`
    });
  }

  return issues;
}

async function sendIssueEmail(params: {
  to: string;
  siteUrl: string;
  issue: AlertIssue;
  aiAnalysis?: { cause: string; suggestedFix: string } | null;
}) {
  if (!resendClient) {
    return;
  }

  const subject = `[MIHARI] Issue detected: ${params.issue.title}`;
  const html = `
<p><strong>Site:</strong> ${params.siteUrl}</p>
<p><strong>Type:</strong> ${params.issue.type}</p>
<p><strong>Severity:</strong> ${params.issue.severity}</p>
<p><strong>Message:</strong> ${params.issue.message}</p>
${
  params.aiAnalysis
    ? `<p><strong>Possible cause:</strong> ${params.aiAnalysis.cause}</p><p><strong>Suggested fix:</strong> ${params.aiAnalysis.suggestedFix}</p>`
    : ""
}
`;

  await resendClient.emails.send({
    from: env.alertFromEmail,
    to: params.to,
    subject,
    html
  });
}

async function sendRecoveryEmail(params: { to: string; siteUrl: string; type: AlertType; title: string }) {
  if (!resendClient) {
    return;
  }

  await resendClient.emails.send({
    from: env.alertFromEmail,
    to: params.to,
    subject: `[MIHARI] Recovered: ${params.title}`,
    html: `<p><strong>Site:</strong> ${params.siteUrl}</p><p>The ${params.type} issue has been resolved.</p>`
  });
}

async function syncAlerts(params: {
  siteId: string;
  user: UserDoc;
  siteUrl: string;
  issues: AlertIssue[];
  aiAnalysis: { cause: string; suggestedFix: string } | null;
}) {
  const activeAlertsSnap = await firestore
    .collection("alerts")
    .where("siteId", "==", params.siteId)
    .where("resolved", "==", false)
    .get();

  const activeByType = new Map<AlertType, QueryDocumentSnapshot>();
  for (const doc of activeAlertsSnap.docs) {
    const data = doc.data();
    activeByType.set(data.type as AlertType, doc);
  }

  const issueByType = new Map(params.issues.map((issue) => [issue.type, issue] as const));
  const batch = firestore.batch();

  for (const issue of params.issues) {
    if (activeByType.has(issue.type)) {
      continue;
    }

    const alertRef = firestore.collection("alerts").doc();
    batch.set(alertRef, {
      alertId: alertRef.id,
      userId: params.user.userId,
      siteId: params.siteId,
      severity: issue.severity,
      type: issue.type,
      title: issue.title,
      message: issue.message,
      resolved: false,
      createdAt: nowIso()
    });

    try {
      await sendIssueEmail({
        to: params.user.email,
        siteUrl: params.siteUrl,
        issue,
        aiAnalysis: params.aiAnalysis
      });
    } catch (error) {
      console.error("Failed to send issue email", error);
    }
  }

  for (const [type, alertDoc] of activeByType.entries()) {
    if (issueByType.has(type)) {
      continue;
    }

    batch.update(alertDoc.ref, {
      resolved: true,
      resolvedAt: nowIso()
    });

    try {
      const data = alertDoc.data();
      await sendRecoveryEmail({
        to: params.user.email,
        siteUrl: params.siteUrl,
        type,
        title: data.title ?? `${type} alert`
      });
    } catch (error) {
      console.error("Failed to send recovery email", error);
    }
  }

  await batch.commit();
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, timestamp: nowIso() });
});

app.post("/tasks/execute", async (req, res) => {
  try {
    requireAuthorizedTask(req);
    const payload = taskPayloadSchema.parse(req.body);
    const checkTypes = Array.from(new Set(payload.checkTypes));

    const jobRef = firestore.collection("checkJobs").doc(payload.jobId);
    await jobRef.set(
      {
        jobId: payload.jobId,
        siteId: payload.siteId,
        userId: payload.userId,
        checkTypes,
        status: "running",
        startedAt: nowIso(),
        scheduledAt: payload.scheduledAt ?? nowIso(),
        finishedAt: null
      },
      { merge: true }
    );

    const userSnap = await firestore.collection("users").doc(payload.userId).get();
    if (!userSnap.exists) {
      throw new Error("User not found for task payload.");
    }
    const user = userSnap.data() as UserDoc;

    const checks = await runChecks(payload.url, checkTypes);
    const overallStatus = resolveOverallStatus(checks, checkTypes);
    const healthScore = computeHealthScore(checks, checkTypes);
    const issues = buildIssues(checks);

    let aiAnalysis: { cause: string; suggestedFix: string } | null = null;
    if (issues.length > 0 && supportsAi(user.plan)) {
      aiAnalysis = await analyzeWithGemini({
        url: payload.url,
        statusCode: checks.uptime.statusCode,
        htmlSnippet: checks.htmlSnippet,
        consoleErrors: checks.rendering.consoleErrors
      });
    }

    const resultRef = firestore.collection("checkResults").doc();
    const writeBatch = firestore.batch();
    writeBatch.set(resultRef, {
      resultId: resultRef.id,
      userId: payload.userId,
      siteId: payload.siteId,
      uptime: checks.uptime,
      links: checks.links,
      form: checks.form,
      rendering: checks.rendering,
      aiAnalysis,
      overallStatus,
      createdAt: nowIso()
    });
    writeBatch.set(
      firestore.collection("sites").doc(payload.siteId),
      {
        status: overallStatus,
        healthScore,
        lastCheckedAt: nowIso()
      },
      { merge: true }
    );
    writeBatch.set(
      jobRef,
      {
        status: "success",
        finishedAt: nowIso()
      },
      { merge: true }
    );
    await writeBatch.commit();

    await syncAlerts({
      siteId: payload.siteId,
      user,
      siteUrl: payload.url,
      issues,
      aiAnalysis
    });

    return res.json({
      ok: true,
      siteId: payload.siteId,
      overallStatus,
      healthScore,
      issues: issues.length
    });
  } catch (error) {
    console.error("Worker task failed", error);

    const message = error instanceof Error ? error.message : "Worker task failed";
    const payload = req.body as Partial<z.infer<typeof taskPayloadSchema>>;
    if (payload.jobId) {
      await firestore
        .collection("checkJobs")
        .doc(payload.jobId)
        .set(
          {
            status: "failed",
            finishedAt: nowIso(),
            errorMessage: message
          },
          { merge: true }
        );
    }

    return res.status(500).json({ error: message });
  }
});

app.listen(env.port, () => {
  console.log(`mihari-worker listening on :${env.port}`);
});
