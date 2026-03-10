import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const decoded = await requireAuth(req);

    const [alertsSnap, sitesSnap] = await Promise.all([
      adminDb.collection("alerts").where("userId", "==", decoded.uid).limit(300).get(),
      adminDb.collection("sites").where("userId", "==", decoded.uid).get()
    ]);

    const domainBySiteId = new Map<string, string>();
    for (const doc of sitesSnap.docs) {
      const site = doc.data();
      try {
        domainBySiteId.set(doc.id, new URL(site.url).hostname);
      } catch {
        domainBySiteId.set(doc.id, site.url ?? doc.id);
      }
    }

    const alerts = alertsSnap.docs
      .map((doc) => doc.data())
      .filter((alert) => alert.resolved !== true)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map((alert) => ({
        ...alert,
        domain: domainBySiteId.get(alert.siteId) ?? alert.siteId
      }));

    return NextResponse.json({ alerts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load alerts" },
      { status: 401 }
    );
  }
}
