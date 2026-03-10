import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

interface RouteParams {
  params: {
    siteId: string;
  };
}

async function deleteCollectionBySiteId(collectionName: string, siteId: string) {
  while (true) {
    const snapshot = await adminDb
      .collection(collectionName)
      .where("siteId", "==", siteId)
      .limit(200)
      .get();

    if (snapshot.empty) {
      return;
    }

    const batch = adminDb.batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();

    if (snapshot.size < 200) {
      return;
    }
  }
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const decoded = await requireAuth(req);
    const siteRef = adminDb.collection("sites").doc(params.siteId);
    const siteSnap = await siteRef.get();
    if (!siteSnap.exists) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const site = siteSnap.data();
    if (site?.userId !== decoded.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [resultsSnap, alertsSnap, jobsSnap] = await Promise.all([
      adminDb
        .collection("checkResults")
        .where("siteId", "==", params.siteId)
        .orderBy("createdAt", "desc")
        .limit(25)
        .get(),
      adminDb
        .collection("alerts")
        .where("siteId", "==", params.siteId)
        .orderBy("createdAt", "desc")
        .limit(25)
        .get(),
      adminDb
        .collection("checkJobs")
        .where("siteId", "==", params.siteId)
        .orderBy("scheduledAt", "desc")
        .limit(25)
        .get()
    ]);

    return NextResponse.json({
      site,
      results: resultsSnap.docs.map((doc) => doc.data()),
      alerts: alertsSnap.docs.map((doc) => doc.data()),
      jobs: jobsSnap.docs.map((doc) => doc.data())
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load site details" },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const decoded = await requireAuth(req);
    const siteRef = adminDb.collection("sites").doc(params.siteId);
    const siteSnap = await siteRef.get();
    if (!siteSnap.exists) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const site = siteSnap.data();
    if (site?.userId !== decoded.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await Promise.all([
      deleteCollectionBySiteId("checkJobs", params.siteId),
      deleteCollectionBySiteId("checkResults", params.siteId),
      deleteCollectionBySiteId("alerts", params.siteId)
    ]);

    await siteRef.delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete site" },
      { status: 400 }
    );
  }
}
