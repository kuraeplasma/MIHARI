import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { nowIso } from "@/lib/time";
import { ClientDoc, SiteDoc } from "@/types/domain";

export const runtime = "nodejs";

const createClientSchema = z.object({
  name: z.string().trim().min(1).max(120)
});

export async function GET(req: NextRequest) {
  try {
    const decoded = await requireAuth(req);

    const [clientsSnap, sitesSnap] = await Promise.all([
      adminDb.collection("clients").where("userId", "==", decoded.uid).orderBy("createdAt", "desc").get(),
      adminDb.collection("sites").where("userId", "==", decoded.uid).get()
    ]);

    const sites = sitesSnap.docs.map((doc) => doc.data() as SiteDoc);
    const clients = clientsSnap.docs.map((doc) => doc.data() as ClientDoc);

    const withStats = clients.map((client) => {
      const linkedSites = sites.filter((site) => site.clientId === client.clientId);
      const lastCheckedAt =
        linkedSites
          .map((site) => site.lastCheckedAt)
          .filter((v): v is string => Boolean(v))
          .sort((a, b) => b.localeCompare(a))[0] ?? null;

      return {
        ...client,
        siteCount: linkedSites.length,
        lastCheckedAt
      };
    });

    return NextResponse.json({
      clients: withStats
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load clients" },
      { status: 401 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const decoded = await requireAuth(req);
    const payload = createClientSchema.parse(await req.json());

    const existing = await adminDb
      .collection("clients")
      .where("userId", "==", decoded.uid)
      .where("name", "==", payload.name)
      .limit(1)
      .get();
    if (!existing.empty) {
      return NextResponse.json({ error: "Client already exists." }, { status: 400 });
    }

    const clientRef = adminDb.collection("clients").doc();
    const timestamp = nowIso();
    const doc: ClientDoc = {
      clientId: clientRef.id,
      userId: decoded.uid,
      name: payload.name,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await clientRef.set(doc);

    return NextResponse.json({ client: { ...doc, siteCount: 0, lastCheckedAt: null } }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create client" },
      { status: 400 }
    );
  }
}
