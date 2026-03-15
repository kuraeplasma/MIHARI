import { DecodedIdToken } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebase-admin";
import { normalizePlanName } from "@/lib/plans";
import { nowIso } from "@/lib/time";
import { UserDoc } from "@/types/domain";

function isLocalTestUser(email?: string | null): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  if (process.env.LOCAL_DISABLE_PLAN_LIMITS === "true") {
    return true;
  }

  const normalizedEmail = (email ?? "").trim().toLowerCase();
  if (!normalizedEmail) {
    return false;
  }

  return (
    normalizedEmail.includes("test") ||
    normalizedEmail.includes("dev") ||
    normalizedEmail.endsWith("@localhost")
  );
}

function defaultSettings(): NonNullable<UserDoc["settings"]> {
  return {
    monitoring: {
      interval: "24h",
      algorithm: "dom",
      sslMonitoringEnabled: true,
      domainMonitoringEnabled: true,
      alertOn30Days: false,
      alertOn7Days: true,
      alertOnExpiry: true,
      customHeaders: "",
      userAgent: "MihariBot/2.0"
    },
    notifications: { emailEnabled: true, slackEnabled: false, notifyOn: "errors" },
    ai: { autoAnalyze: true, scope: "full" }
  };
}

function withLocalUnlimitedPlan(user: UserDoc): UserDoc {
  if (!isLocalTestUser(user.email)) {
    return user;
  }

  return { ...user, plan: "enterprise" };
}

export async function getOrCreateUser(decoded: DecodedIdToken): Promise<UserDoc> {
  const userRef = adminDb.collection("users").doc(decoded.uid);
  const snapshot = await userRef.get();

  if (snapshot.exists) {
    const user = snapshot.data() as UserDoc;
    const normalizedPlan = normalizePlanName(user.plan);
    const settings = {
      ...defaultSettings(),
      ...(user.settings ?? {}),
      monitoring: {
        ...defaultSettings().monitoring,
        ...(user.settings?.monitoring ?? {})
      },
      notifications: {
        ...defaultSettings().notifications,
        ...(user.settings?.notifications ?? {})
      },
      ai: {
        ...defaultSettings().ai,
        ...(user.settings?.ai ?? {})
      }
    };

    const updates: Partial<UserDoc> = {};
    if (user.plan !== normalizedPlan) {
      user.plan = normalizedPlan;
      updates.plan = normalizedPlan;
    }

    if (JSON.stringify(user.settings ?? null) !== JSON.stringify(settings)) {
      user.settings = settings;
      updates.settings = settings;
    }

    if (Object.keys(updates).length > 0) {
      await userRef.update(updates);
    }

    return withLocalUnlimitedPlan(user);
  }

  const user: UserDoc = {
    userId: decoded.uid,
    email: decoded.email ?? "",
    plan: "starter",
    settings: defaultSettings(),
    createdAt: nowIso()
  };
  await userRef.set(user);
  return withLocalUnlimitedPlan(user);
}
