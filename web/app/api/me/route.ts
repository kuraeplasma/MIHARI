import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-guard";
import { adminDb } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/ratelimit";
import { normalizePlanName } from "@/lib/plans";
import { computeNextBillingAt } from "@/lib/billing";
import { nowIso } from "@/lib/time";
import { BillingHistoryDoc, UserDoc } from "@/types/domain";

export const runtime = "nodejs";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_AVATAR_DATA_URL_LENGTH = 2_800_000;

type UserSettings = NonNullable<UserDoc["settings"]>;
type MonitoringSettings = UserSettings["monitoring"];

const DEFAULT_SETTINGS: NonNullable<UserDoc["settings"]> = {
  monitoring: {
    interval: "24h",
    algorithm: "dom",
    sslMonitoringEnabled: true,
    domainMonitoringEnabled: true,
    alertOn30Days: false,
    alertOn7Days: true,
    alertOnExpiry: true,
    customHeaders: "",
    userAgent: "MihariBot/2.0"
  },
  notifications: { emailEnabled: true, slackEnabled: false, notifyOn: "errors", slackWebhookUrl: "" },
  ai: { autoAnalyze: true, scope: "full" }
};

const monitoringPatchSchema = z
  .object({
    interval: z.enum(["5m", "15m", "1h", "6h", "24h"]).optional(),
    algorithm: z.enum(["dom", "text", "html"]).optional(),
    sslMonitoringEnabled: z.boolean().optional(),
    domainMonitoringEnabled: z.boolean().optional(),
    alertOn30Days: z.boolean().optional(),
    alertOn7Days: z.boolean().optional(),
    alertOnExpiry: z.boolean().optional(),
    customHeaders: z.string().max(4000).optional(),
    userAgent: z.string().max(255).optional()
  })
  .strict();

const notificationsPatchSchema = z
  .object({
    emailEnabled: z.boolean().optional(),
    slackEnabled: z.boolean().optional(),
    slackWebhookUrl: z.string().max(500).optional(),
    notifyOn: z.enum(["all", "errors", "critical"]).optional()
  })
  .strict();

const aiPatchSchema = z
  .object({
    autoAnalyze: z.boolean().optional(),
    scope: z.enum(["full", "summary"]).optional()
  })
  .strict();

const settingsPatchSchema = z
  .object({
    monitoring: monitoringPatchSchema.optional(),
    notifications: notificationsPatchSchema.optional(),
    ai: aiPatchSchema.optional()
  })
  .strict();

const mePatchSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    workspaceName: z.string().trim().min(1).max(120).optional(),
    billingCompanyName: z.string().trim().max(160).optional(),
    avatarDataUrl: z.union([z.string().max(MAX_AVATAR_DATA_URL_LENGTH), z.literal(null)]).optional(),
    settings: settingsPatchSchema.optional()
  })
  .strict();

interface UsageCheckResultDoc {
  createdAt?: string;
  aiAnalysis?: unknown;
}

interface BillingHistoryResponse {
  billingId: string;
  billedAt: string;
  description: string;
  amount: number | null;
  currency: "JPY";
  status: "scheduled" | "paid" | "failed";
  receiptUrl: string | null;
}

function isValidAvatarDataUrl(value: string): boolean {
  const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    return false;
  }

  const base64 = match[2];
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const bytes = (base64.length * 3) / 4 - padding;
  return bytes > 0 && bytes <= MAX_AVATAR_BYTES;
}

function normalizeMonitoring(input: Partial<MonitoringSettings> | undefined): MonitoringSettings {
  return {
    ...DEFAULT_SETTINGS.monitoring,
    ...(input ?? {}),
    customHeaders: typeof input?.customHeaders === "string" ? input.customHeaders : "",
    userAgent:
      typeof input?.userAgent === "string" && input.userAgent.trim().length > 0
        ? input.userAgent.trim()
        : DEFAULT_SETTINGS.monitoring.userAgent
  };
}

function normalizeSettings(input: UserDoc["settings"] | undefined): NonNullable<UserDoc["settings"]> {
  return {
    monitoring: normalizeMonitoring(input?.monitoring),
    notifications: {
      ...DEFAULT_SETTINGS.notifications,
      ...(input?.notifications ?? {}),
      slackWebhookUrl: typeof input?.notifications?.slackWebhookUrl === "string" ? input.notifications.slackWebhookUrl : ""
    },
    ai: {
      ...DEFAULT_SETTINGS.ai,
      ...(input?.ai ?? {})
    }
  };
}

function normalizeBilling(input: UserDoc["billing"] | undefined, createdAt: string): NonNullable<UserDoc["billing"]> {
  const cycle = input?.cycle === "annual" ? "annual" : "monthly";
  const status =
    input?.status === "trialing" ||
    input?.status === "past_due" ||
    input?.status === "canceled" ||
    input?.status === "active"
      ? input.status
      : "active";

  const nextBillingAt =
    typeof input?.nextBillingAt === "string" && input.nextBillingAt.length > 0
      ? input.nextBillingAt
      : computeNextBillingAt(cycle, new Date(createdAt));

  return {
    cycle,
    status,
    nextBillingAt,
    updatedAt: input?.updatedAt ?? nowIso()
  };
}

function currentMonthStartIso(): string {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  return monthStart.toISOString();
}

function hasAiAnalysis(data: UsageCheckResultDoc): boolean {
  return data.aiAnalysis !== null && data.aiAnalysis !== undefined;
}

async function countMonthlyAiUsage(userId: string): Promise<number> {
  const monthStartIso = currentMonthStartIso();
  const pageSize = 400;
  const maxDocs = 4000;
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  let scanned = 0;
  let count = 0;

  while (scanned < maxDocs) {
    let query = adminDb.collection("checkResults").where("userId", "==", userId).limit(pageSize);
    if (cursor) {
      query = query.startAfter(cursor);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      break;
    }

    scanned += snapshot.size;

    for (const doc of snapshot.docs) {
      const data = doc.data() as UsageCheckResultDoc;
      if (typeof data.createdAt !== "string") {
        continue;
      }
      if (data.createdAt < monthStartIso) {
        continue;
      }
      if (hasAiAnalysis(data)) {
        count += 1;
      }
    }

    if (snapshot.size < pageSize) {
      break;
    }

    cursor = snapshot.docs[snapshot.docs.length - 1];
  }

  return count;
}

async function listBillingHistory(userId: string): Promise<BillingHistoryResponse[]> {
  const snapshot = await adminDb.collection("billingHistory").where("userId", "==", userId).limit(200).get();

  const rows = snapshot.docs
    .map((doc) => {
      const data = doc.data() as Partial<BillingHistoryDoc>;
      return {
        billingId: typeof data.billingId === "string" ? data.billingId : doc.id,
        billedAt: typeof data.billedAt === "string" ? data.billedAt : nowIso(),
        description: typeof data.description === "string" ? data.description : "Plan update",
        amount: typeof data.amount === "number" ? data.amount : null,
        currency: "JPY" as const,
        status:
          data.status === "paid" || data.status === "failed" || data.status === "scheduled"
            ? data.status
            : "scheduled",
        receiptUrl: typeof data.receiptUrl === "string" ? data.receiptUrl : null
      };
    })
    .sort((a, b) => b.billedAt.localeCompare(a.billedAt))
    .slice(0, 10);

  return rows;
}

async function buildMeResponse(user: UserDoc) {
  const [monthlyAiUsage, billingHistory] = await Promise.all([
    countMonthlyAiUsage(user.userId).catch(() => 0),
    listBillingHistory(user.userId).catch(() => [])
  ]);

  return {
    ...user,
    monthlyAiUsage,
    billingHistory
  };
}

async function upsertUser(req: NextRequest) {
  const limited = await enforceRateLimit(req, "api:me:upsert");
  if (limited) {
    return limited;
  }

  const auth = await requireAuth(req);
  if (auth.error) {
    return auth.error;
  }

  try {
    const decoded = auth.user;
    const userRef = adminDb.collection("users").doc(decoded.uid);
    const snapshot = await userRef.get();

    if (!snapshot.exists) {
      const createdAt = nowIso();
      const user: UserDoc = {
        userId: decoded.uid,
        email: decoded.email ?? "",
        plan: "starter",
        displayName: decoded.name ?? decoded.email?.split("@")[0] ?? "User",
        workspaceName: "My Workspace",
        billingCompanyName: "",
        avatarDataUrl: null,
        settings: normalizeSettings(undefined),
        billing: normalizeBilling(undefined, createdAt),
        createdAt
      };
      await userRef.set(user);
      return NextResponse.json(await buildMeResponse(user));
    }

    const data = snapshot.data() as UserDoc;
    const normalizedPlan = normalizePlanName(data.plan);
    const normalizedSettings = normalizeSettings(data.settings);
    const createdAt = typeof data.createdAt === "string" ? data.createdAt : nowIso();
    const normalizedBilling = normalizeBilling(data.billing, createdAt);
    const displayName = data.displayName ?? decoded.name ?? decoded.email?.split("@")[0] ?? "User";
    const workspaceName = data.workspaceName ?? "My Workspace";
    const billingCompanyName = typeof data.billingCompanyName === "string" ? data.billingCompanyName : "";
    const avatarDataUrl =
      typeof data.avatarDataUrl === "string" && isValidAvatarDataUrl(data.avatarDataUrl)
        ? data.avatarDataUrl
        : data.avatarDataUrl === null
          ? null
          : null;

    const updates: Partial<UserDoc> = {};

    if (data.plan !== normalizedPlan) {
      updates.plan = normalizedPlan;
      data.plan = normalizedPlan;
    }

    if (JSON.stringify(data.settings ?? null) !== JSON.stringify(normalizedSettings)) {
      updates.settings = normalizedSettings;
      data.settings = normalizedSettings;
    }

    if (JSON.stringify(data.billing ?? null) !== JSON.stringify(normalizedBilling)) {
      updates.billing = normalizedBilling;
      data.billing = normalizedBilling;
    }

    if (data.displayName !== displayName) {
      updates.displayName = displayName;
      data.displayName = displayName;
    }

    if (data.workspaceName !== workspaceName) {
      updates.workspaceName = workspaceName;
      data.workspaceName = workspaceName;
    }

    if (data.billingCompanyName !== billingCompanyName) {
      updates.billingCompanyName = billingCompanyName;
      data.billingCompanyName = billingCompanyName;
    }

    if (data.avatarDataUrl !== avatarDataUrl) {
      updates.avatarDataUrl = avatarDataUrl;
      data.avatarDataUrl = avatarDataUrl;
    }

    if (Object.keys(updates).length > 0) {
      await userRef.update(updates);
    }

    return NextResponse.json(await buildMeResponse(data));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Authentication failed" },
      { status: 401 }
    );
  }
}

export async function GET(req: NextRequest) {
  return upsertUser(req);
}

export async function POST(req: NextRequest) {
  return upsertUser(req);
}

export async function PATCH(req: NextRequest) {
  const limited = await enforceRateLimit(req, "api:me:patch");
  if (limited) {
    return limited;
  }

  const auth = await requireAuth(req);
  if (auth.error) {
    return auth.error;
  }

  try {
    const decoded = auth.user;
    const userRef = adminDb.collection("users").doc(decoded.uid);
    const snapshot = await userRef.get();

    if (!snapshot.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const current = snapshot.data() as UserDoc;
    const payload = mePatchSchema.parse(await req.json());

    if (typeof payload.avatarDataUrl === "string" && !isValidAvatarDataUrl(payload.avatarDataUrl)) {
      return NextResponse.json({ error: "Avatar image format is invalid." }, { status: 400 });
    }

    const updates: Partial<UserDoc> = {};

    if (payload.displayName !== undefined) {
      updates.displayName = payload.displayName;
    }

    if (payload.workspaceName !== undefined) {
      updates.workspaceName = payload.workspaceName;
    }

    if (payload.billingCompanyName !== undefined) {
      updates.billingCompanyName = payload.billingCompanyName;
    }

    if (payload.avatarDataUrl !== undefined) {
      updates.avatarDataUrl = payload.avatarDataUrl;
    }

    if (payload.settings) {
      const currentSettings = normalizeSettings(current.settings);
      updates.settings = normalizeSettings({
        ...currentSettings,
        ...payload.settings,
        monitoring: {
          ...currentSettings.monitoring,
          ...(payload.settings.monitoring ?? {})
        },
        notifications: {
          ...currentSettings.notifications,
          ...(payload.settings.notifications ?? {})
        },
        ai: {
          ...currentSettings.ai,
          ...(payload.settings.ai ?? {})
        }
      });
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(await buildMeResponse(current));
    }

    await userRef.update(updates);

    const updatedSnap = await userRef.get();
    const updated = updatedSnap.data() as UserDoc;
    return NextResponse.json(await buildMeResponse(updated));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message ?? "Invalid payload" }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 400 }
    );
  }
}


