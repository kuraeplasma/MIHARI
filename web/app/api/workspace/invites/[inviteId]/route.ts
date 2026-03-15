import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { adminDb } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

interface RouteParams {
  params: {
    inviteId: string;
  };
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const limited = await enforceRateLimit(req, "api:workspace-invites-inviteid:delete");
  if (limited) {
    return limited;
  }

  const auth = await requireAuth(req);
  if (auth.error) {
    return auth.error;
  }

  try {
    const decoded = auth.user;
    const inviteRef = adminDb.collection("workspaceInvites").doc(params.inviteId);
    const snapshot = await inviteRef.get();

    if (!snapshot.exists) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    const invite = snapshot.data() as { userId?: string };
    if (invite.userId !== decoded.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await inviteRef.delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete invite" },
      { status: 400 }
    );
  }
}
