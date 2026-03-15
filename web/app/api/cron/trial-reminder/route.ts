import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { adminDb } from "@/lib/firebase-admin";
import { nowIso } from "@/lib/time";
import { UserDoc } from "@/types/domain";

export const runtime = "nodejs";

function isoDayRange(daysAhead: number): { startIso: string; endIso: string } {
  const target = new Date();
  target.setUTCDate(target.getUTCDate() + daysAhead);

  const start = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate(), 23, 59, 59, 999));

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString()
  };
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");

  if (!resendApiKey || !fromEmail) {
    return NextResponse.json(
      { error: "Resend configuration is missing. Set RESEND_API_KEY and RESEND_FROM_EMAIL." },
      { status: 503 }
    );
  }

  const resend = new Resend(resendApiKey);
  const { startIso, endIso } = isoDayRange(3);
  const reminderDay = todayYmd();

  const snapshot = await adminDb
    .collection("users")
    .where("billing.status", "==", "trialing")
    .where("trialEndAt", ">=", startIso)
    .where("trialEndAt", "<=", endIso)
    .get();

  let sent = 0;
  let skipped = 0;
  const failed: string[] = [];

  for (const doc of snapshot.docs) {
    const user = doc.data() as UserDoc;
    const email = typeof user.email === "string" ? user.email.trim() : "";

    if (!email) {
      skipped += 1;
      continue;
    }

    const alreadySentAt =
      typeof user.trialReminder3dSentAt === "string" && user.trialReminder3dSentAt.length > 0
        ? user.trialReminder3dSentAt
        : null;

    if (alreadySentAt?.startsWith(reminderDay)) {
      skipped += 1;
      continue;
    }

    try {
      await resend.emails.send({
        from: fromEmail,
        to: email,
        subject: "【MIHARI】無料トライアル終了3日前のお知らせ",
        html: `
          <p>${user.displayName ?? "ご担当者"}様</p>
          <p>MIHARIの14日間無料トライアルは<strong>3日後</strong>に終了します。</p>
          <p>継続利用される場合は、登録済みのカードにより自動で有料プランへ移行されます。</p>
          <p>解約される場合は、終了日までに以下からお手続きください。</p>
          <p><a href="${appUrl}/dashboard/settings">プラン・請求設定を開く</a></p>
        `
      });

      await doc.ref.set(
        {
          trialReminder3dSentAt: nowIso()
        },
        { merge: true }
      );

      sent += 1;
    } catch {
      failed.push(doc.id);
    }
  }

  return NextResponse.json({
    sent,
    skipped,
    failedCount: failed.length,
    failedUserIds: failed
  });
}
