import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { adminDb } from "@/lib/firebase-admin";
import { getServerEnv } from "@/lib/env";
import { enforceRateLimit } from "@/lib/ratelimit";
import { nowIso } from "@/lib/time";

export const runtime = "nodejs";

interface RouteParams {
  params: {
    siteId: string;
  };
}

function buildDispatchUrl(baseUrl: string) {
  return `${baseUrl.replace(/\/$/, "")}/dispatch`;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const limited = await enforceRateLimit(req, "api:sites-siteid-run:post");
  if (limited) {
    return limited;
  }

  const auth = await requireAuth(req);
  if (auth.error) {
    return auth.error;
  }

  try {
    const { dispatcherUrl, dispatcherSecret } = getServerEnv();
    if (!dispatcherUrl) {
      return NextResponse.json(
        { error: "MONITOR_DISPATCHER_URL が未設定のため、今すぐ解析を実行できません。" },
        { status: 503 }
      );
    }

    const siteRef = adminDb.collection("sites").doc(params.siteId);
    const siteSnap = await siteRef.get();

    if (!siteSnap.exists) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const site = siteSnap.data();
    if (site?.userId !== auth.user.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const queuedAt = nowIso();
    await siteRef.update({ nextCheckAt: queuedAt });

    const dispatchRes = await fetch(buildDispatchUrl(dispatcherUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(dispatcherSecret ? { "x-mihari-secret": dispatcherSecret } : {})
      },
      body: "{}",
      cache: "no-store"
    });

    if (!dispatchRes.ok) {
      const text = await dispatchRes.text().catch(() => "");
      throw new Error(`Dispatcher request failed (${dispatchRes.status}) ${text}`.trim());
    }

    return NextResponse.json({ ok: true, queuedAt });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to queue check" },
      { status: 400 }
    );
  }
}
