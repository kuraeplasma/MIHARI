import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { triggerMonitoringDispatch } from "@/lib/monitoring";
import { PLANS } from "@/lib/plans";
import { nowIso } from "@/lib/time";
import { normalizeUrl } from "@/lib/url";
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
    createdAt
  };
  await docRef.set(site);

  return site;
}

export async function GET(req: NextRequest) {
  try {
    const decoded = await requireAuth(req);
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
  try {
    const decoded = await requireAuth(req);
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
