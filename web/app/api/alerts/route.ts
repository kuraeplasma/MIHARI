import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { adminDb } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, "api:alerts:get");
  if (limited) {
    return limited;
  }

  const auth = await requireAuth(req);
  if (auth.error) {
    return auth.error;
  }

  try {
    const decoded = auth.user;
    const unresolvedOnly = req.nextUrl.searchParams.get("unresolved") === "1";

    const [alertsSnap, sitesSnap] = await Promise.all([
      adminDb.collection("alerts").where("userId", "==", decoded.uid).limit(500).get(),
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
      .filter((alert) => (unresolvedOnly ? alert.resolved !== true : true))
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
