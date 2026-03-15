import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-guard";
import { enforceRateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

const slackTestSchema = z.object({
  webhookUrl: z.string().trim().url().max(500)
});

function isAllowedSlackWebhook(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  return (
    parsed.protocol === "https:" &&
    parsed.hostname === "hooks.slack.com" &&
    parsed.pathname.startsWith("/services/")
  );
}

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, "api:notifications-slack-test:post");
  if (limited) {
    return limited;
  }

  const auth = await requireAuth(req);
  if (auth.error) {
    return auth.error;
  }

  try {
    const payload = slackTestSchema.parse(await req.json());

    if (!isAllowedSlackWebhook(payload.webhookUrl)) {
      return NextResponse.json({ error: "Slack Incoming Webhook URL の形式が不正です。" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let response: Response;
    try {
      response = await fetch(payload.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: "MIHARI テスト通知: Slack連携は正常です。" }),
        signal: controller.signal,
        cache: "no-store"
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return NextResponse.json(
        { error: `Slack通知に失敗しました (${response.status}) ${detail}`.trim() },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message ?? "Invalid payload" }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send Slack test notification" },
      { status: 400 }
    );
  }
}
