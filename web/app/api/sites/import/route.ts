import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { requireAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { triggerMonitoringDispatch } from "@/lib/monitoring";
import { PLANS } from "@/lib/plans";
import { nowIso } from "@/lib/time";
import { normalizeUrl } from "@/lib/url";
import { getOrCreateUser } from "@/lib/users";
import { SiteDoc } from "@/types/domain";

export const runtime = "nodejs";

function extractUrlsFromCsv(csvText: string): string[] {
  const parsed = Papa.parse<string[]>(csvText, {
    skipEmptyLines: true
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0].message);
  }

  const candidates: string[] = [];
  for (const row of parsed.data) {
    for (const cell of row) {
      const value = cell.trim();
      if (!value) {
        continue;
      }
      if (/^https?:\/\//i.test(value) || /^[a-z0-9.-]+\.[a-z]{2,}/i.test(value)) {
        candidates.push(value);
      }
    }
  }
  return candidates;
}

export async function POST(req: NextRequest) {
  try {
    const decoded = await requireAuth(req);
    const user = await getOrCreateUser(decoded);
    const formData = await req.formData();
    const file = formData.get("file");
    const clientIdRaw = formData.get("clientId");
    const clientId = typeof clientIdRaw === "string" && clientIdRaw.trim() ? clientIdRaw.trim() : null;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "CSV file is required." }, { status: 400 });
    }

    if (clientId) {
      const clientSnap = await adminDb.collection("clients").doc(clientId).get();
      if (!clientSnap.exists || clientSnap.data()?.userId !== user.userId) {
        return NextResponse.json({ error: "Invalid clientId." }, { status: 400 });
      }
    }

    const csvText = await file.text();
    const rawUrls = extractUrlsFromCsv(csvText);
    if (rawUrls.length === 0) {
      return NextResponse.json({ error: "No URLs found in CSV file." }, { status: 400 });
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
    for (const candidate of rawUrls) {
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
      { error: error instanceof Error ? error.message : "CSV import failed" },
      { status: 400 }
    );
  }
}
