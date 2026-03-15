import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-guard";
import { adminDb } from "@/lib/firebase-admin";
import { triggerMonitoringDispatch } from "@/lib/monitoring";
import { PLANS } from "@/lib/plans";
import { enforceRateLimit } from "@/lib/ratelimit";
import { nowIso } from "@/lib/time";
import { normalizeUrl, validateCrawlUrl } from "@/lib/url";
import { getOrCreateUser } from "@/lib/users";
import { SiteDoc, UserDoc } from "@/types/domain";

export const runtime = "nodejs";

const addSiteSchema = z.object({
  url: z.string().min(1),
  clientId: z.string().optional().nullable(),
  formMonitorEnabled: z.boolean().optional()
});

async function listSites(user: UserDoc) {
  const query = await adminDb
    .collection("sites")
    .where("userId", "==", user.userId)
    .orderBy("createdAt", "desc")
    .get();

  return query.docs.map((doc) => doc.data());
}

async function createSite(user: UserDoc, payload: z.infer<typeof addSiteSchema>) {
  const plan = PLANS[user.plan];
  const existing = await adminDb.collection("sites").where("userId", "==", user.userId).get();
  if (existing.size >= plan.maxSites) {
    throw new Error(`Your ${plan.name} plan supports up to ${plan.maxSites} website(s).`);
  }

  const url = normalizeUrl(payload.url);
  const isSafe = await validateCrawlUrl(url);
  if (!isSafe) {
    throw new Error("Invalid or unsafe URL.");
  }

  const duplicate = existing.docs.find((doc) => (doc.data() as SiteDoc).url === url);
  if (duplicate) {
    throw new Error("This website is already registered.");
  }

  const clientId = payload.clientId ?? null;
  if (clientId) {
    const clientSnap = await adminDb.collection("clients").doc(clientId).get();
    if (!clientSnap.exists || clientSnap.data()?.userId !== user.userId) {
      throw new Error("Invalid clientId.");
    }
  }

  const docRef = adminDb.collection("sites").doc();
  const createdAt = nowIso();
  const site: SiteDoc = {
    siteId: docRef.id,
    userId: user.userId,
    clientId,
    url,
    status: "pending",
    healthScore: 0,
    lastCheckedAt: null,
    nextCheckAt: nowIso(),
    formMonitorEnabled: plan.formMonitoring && payload.formMonitorEnabled !== false,
    ssl_expiry_days: null,
    ssl_expiry_date: null,
    ssl_checked_at: null,
    domain_expiry_days: null,
    domain_expiry_date: null,
    domain_checked_at: null,
    createdAt
  };
  await docRef.set(site);

  return site;
}

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, "api:sites:get");
  if (limited) {
    return limited;
  }

  const auth = await requireAuth(req);
  if (auth.error) {
    return auth.error;
  }

  try {
    const decoded = auth.user;
    const user = await getOrCreateUser(decoded);
    const sites = await listSites(user);
    return NextResponse.json({ sites, plan: PLANS[user.plan] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load sites" },
      { status: 401 }
    );
  }
}

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, "api:sites:post");
  if (limited) {
    return limited;
  }

  const auth = await requireAuth(req);
  if (auth.error) {
    return auth.error;
  }

  try {
    const decoded = auth.user;
    const user = await getOrCreateUser(decoded);
    const body = await req.json();
    const payload = addSiteSchema.parse(body);

    const site = await createSite(user, payload);
    await triggerMonitoringDispatch();
    return NextResponse.json({ site }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create site" },
      { status: 400 }
    );
  }
}
