import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { triggerMonitoringDispatch } from "@/lib/monitoring";
import { PLANS } from "@/lib/plans";
import { nowIso } from "@/lib/time";
import { normalizeUrl } from "@/lib/url";
import { getOrCreateUser } from "@/lib/users";
import { SiteDoc } from "@/types/domain";

export const runtime = "nodejs";

const bulkSchema = z.object({
  urls: z.array(z.string()).min(1).max(1000),
  clientId: z.string().optional().nullable()
});

export async function POST(req: NextRequest) {
  try {
    const decoded = await requireAuth(req);
    const user = await getOrCreateUser(decoded);
    const payload = bulkSchema.parse(await req.json());
    const clientId = payload.clientId ?? null;

    if (clientId) {
      const clientSnap = await adminDb.collection("clients").doc(clientId).get();
      if (!clientSnap.exists || clientSnap.data()?.userId !== user.userId) {
        return NextResponse.json({ error: "Invalid clientId." }, { status: 400 });
      }
    }

    const existingSnapshot = await adminDb
      .collection("sites")
      .where("userId", "==", user.userId)
      .get();
    const existingUrls = new Set(existingSnapshot.docs.map((doc) => (doc.data() as SiteDoc).url));

    const plan = PLANS[user.plan];
    const availableSlots = plan.maxSites - existingSnapshot.size;
    if (availableSlots <= 0) {
      return NextResponse.json(
        { error: `Your ${plan.name} plan supports up to ${plan.maxSites} website(s).` },
        { status: 400 }
      );
    }

    const normalized: string[] = [];
    const rejected: Array<{ input: string; reason: string }> = [];
    for (const candidate of payload.urls) {
      try {
        const url = normalizeUrl(candidate);
        if (existingUrls.has(url) || normalized.includes(url)) {
          rejected.push({ input: candidate, reason: "duplicate" });
          continue;
        }
        normalized.push(url);
      } catch {
        rejected.push({ input: candidate, reason: "invalid_url" });
      }
    }

    const accepted = normalized.slice(0, availableSlots);
    const overflow = normalized.slice(availableSlots);
    for (const item of overflow) {
      rejected.push({ input: item, reason: "plan_limit" });
    }

    const now = nowIso();
    const batch = adminDb.batch();
    const created: SiteDoc[] = [];

    for (const url of accepted) {
      const siteRef = adminDb.collection("sites").doc();
      const site: SiteDoc = {
        siteId: siteRef.id,
        userId: user.userId,
        clientId,
        url,
        status: "pending",
        healthScore: 0,
        lastCheckedAt: null,
        nextCheckAt: now,
        formMonitorEnabled: plan.formMonitoring,
        createdAt: now
      };
      created.push(site);
      batch.set(siteRef, site);
    }

    await batch.commit();
    if (created.length > 0) {
      await triggerMonitoringDispatch();
    }
    return NextResponse.json({ created, rejected }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bulk registration failed" },
      { status: 400 }
    );
  }
}
