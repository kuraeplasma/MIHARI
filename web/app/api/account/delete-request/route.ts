import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { adminDb } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/ratelimit";
import { nowIso } from "@/lib/time";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, "api:account-delete-request:post");
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
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const existing = await adminDb
      .collection("accountDeletionRequests")
      .where("userId", "==", decoded.uid)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    if (!existing.empty) {
      return NextResponse.json({ ok: true, status: "already_pending" });
    }

    const requestRef = adminDb.collection("accountDeletionRequests").doc();
    const now = nowIso();
    const user = userSnap.data() as { email?: string; displayName?: string };

    await requestRef.set({
      requestId: requestRef.id,
      userId: decoded.uid,
      email: user.email ?? decoded.email ?? "",
      displayName: user.displayName ?? decoded.name ?? "",
      status: "pending",
      createdAt: now,
      updatedAt: now
    });

    return NextResponse.json({ ok: true, status: "pending", requestId: requestRef.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create deletion request" },
      { status: 400 }
    );
  }
}
