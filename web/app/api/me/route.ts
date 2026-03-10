import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { nowIso } from "@/lib/time";
import { UserDoc } from "@/types/domain";

export const runtime = "nodejs";

async function upsertUser(req: NextRequest) {
  try {
    const decoded = await requireAuth(req);
    const userRef = adminDb.collection("users").doc(decoded.uid);
    const snapshot = await userRef.get();

    if (!snapshot.exists) {
      const createdAt = nowIso();
      const user: UserDoc = {
        userId: decoded.uid,
        email: decoded.email ?? "",
        plan: "free",
        createdAt
      };
      await userRef.set(user);
      return NextResponse.json(user);
    }

    return NextResponse.json(snapshot.data());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Authentication failed" },
      { status: 401 }
    );
  }
}

export async function GET(req: NextRequest) {
  return upsertUser(req);
}

export async function POST(req: NextRequest) {
  return upsertUser(req);
}
