import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { normalizePlanName } from "@/lib/plans";
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
        plan: "starter",
        displayName: decoded.name ?? decoded.email?.split("@")[0] ?? "User",
        workspaceName: "My Workspace",
        settings: {
          monitoring: { interval: "24h", algorithm: "dom" },
          notifications: { emailEnabled: true, slackEnabled: false, notifyOn: "errors" },
          ai: { autoAnalyze: true, scope: "full" }
        },
        createdAt
      };
      await userRef.set(user);
      return NextResponse.json(user);
    }

    const data = snapshot.data() as UserDoc;
    const normalizedPlan = normalizePlanName(data.plan);
    if (data.plan !== normalizedPlan) {
      data.plan = normalizedPlan;
      await userRef.update({ plan: normalizedPlan });
    }

    // Backfill settings if they don't exist
    if (!data.settings) {
      data.settings = {
        monitoring: { interval: "24h", algorithm: "dom" },
        notifications: { emailEnabled: true, slackEnabled: false, notifyOn: "errors" },
        ai: { autoAnalyze: true, scope: "full" }
      };
      data.displayName = data.displayName ?? decoded.name ?? decoded.email?.split("@")[0] ?? "User";
      data.workspaceName = data.workspaceName ?? "My Workspace";
      await userRef.update({
        settings: data.settings,
        displayName: data.displayName,
        workspaceName: data.workspaceName
      });
    }

    return NextResponse.json(data);
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

export async function PATCH(req: NextRequest) {
  try {
    const decoded = await requireAuth(req);
    const userRef = adminDb.collection("users").doc(decoded.uid);
    const snapshot = await userRef.get();

    if (!snapshot.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updates = await req.json();

    // Protect internal fields
    delete updates.userId;
    delete updates.email;
    delete updates.plan;
    delete updates.createdAt;

    await userRef.update(updates);

    const updatedSnap = await userRef.get();
    return NextResponse.json(updatedSnap.data());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 400 }
    );
  }
}
