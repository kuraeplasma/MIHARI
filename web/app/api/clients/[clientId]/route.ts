import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

interface RouteParams {
  params: {
    clientId: string;
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const decoded = await requireAuth(req);
    const clientRef = adminDb.collection("clients").doc(params.clientId);
    const clientSnap = await clientRef.get();
    if (!clientSnap.exists) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const client = clientSnap.data();
    if (client?.userId !== decoded.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sitesSnap = await adminDb
      .collection("sites")
      .where("userId", "==", decoded.uid)
      .where("clientId", "==", params.clientId)
      .orderBy("createdAt", "desc")
      .get();

    return NextResponse.json({
      client,
      sites: sitesSnap.docs.map((doc) => doc.data())
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load client details" },
      { status: 400 }
    );
  }
}
