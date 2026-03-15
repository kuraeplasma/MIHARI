import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-guard";
import { adminDb } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/ratelimit";
import { nowIso } from "@/lib/time";

export const runtime = "nodejs";

const createInviteSchema = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(["member", "viewer"]).default("member")
});

interface WorkspaceInviteDoc {
  inviteId: string;
  userId: string;
  email: string;
  role: "member" | "viewer";
  status: "pending";
  token: string;
  inviteUrl: string;
  createdAt: string;
  updatedAt: string;
}

function sanitizeInvite(doc: WorkspaceInviteDoc) {
  return {
    inviteId: doc.inviteId,
    email: doc.email,
    role: doc.role,
    status: doc.status,
    inviteUrl: doc.inviteUrl,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  };
}

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, "api:workspace-invites:get");
  if (limited) {
    return limited;
  }

  const auth = await requireAuth(req);
  if (auth.error) {
    return auth.error;
  }

  try {
    const decoded = auth.user;
    const snapshot = await adminDb
      .collection("workspaceInvites")
      .where("userId", "==", decoded.uid)
      .limit(200)
      .get();

    const invites = snapshot.docs
      .map((doc) => doc.data() as WorkspaceInviteDoc)
      .filter((doc) => doc.status === "pending")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 100)
      .map(sanitizeInvite);

    return NextResponse.json({ invites });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load invites" },
      { status: 401 }
    );
  }
}

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, "api:workspace-invites:post");
  if (limited) {
    return limited;
  }

  const auth = await requireAuth(req);
  if (auth.error) {
    return auth.error;
  }

  try {
    const decoded = auth.user;
    const payload = createInviteSchema.parse(await req.json());
    const email = payload.email.toLowerCase();

    if (decoded.email && email === decoded.email.toLowerCase()) {
      return NextResponse.json({ error: "自分自身は招待できません。" }, { status: 400 });
    }

    const existing = await adminDb
      .collection("workspaceInvites")
      .where("userId", "==", decoded.uid)
      .limit(200)
      .get();

    const duplicate = existing.docs.some((doc) => {
      const data = doc.data() as WorkspaceInviteDoc;
      return data.status === "pending" && data.email === email;
    });

    if (duplicate) {
      return NextResponse.json({ error: "このメールアドレスには既に招待済みです。" }, { status: 400 });
    }

    const inviteRef = adminDb.collection("workspaceInvites").doc();
    const token = crypto.randomUUID().replace(/-/g, "");
    const origin = req.nextUrl.origin;
    const timestamp = nowIso();

    const invite: WorkspaceInviteDoc = {
      inviteId: inviteRef.id,
      userId: decoded.uid,
      email,
      role: payload.role,
      status: "pending",
      token,
      inviteUrl: `${origin}/register?invite=${encodeURIComponent(token)}`,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await inviteRef.set(invite);
    return NextResponse.json({ invite: sanitizeInvite(invite) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message ?? "Invalid payload" }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create invite" },
      { status: 400 }
    );
  }
}
