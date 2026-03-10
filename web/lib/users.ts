import { DecodedIdToken } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebase-admin";
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

function withLocalUnlimitedPlan(user: UserDoc): UserDoc {
  if (!isLocalTestUser(user.email)) {
    return user;
  }

  // Local testing only: remove plan-based caps and feature restrictions.
  return { ...user, plan: "agency" };
}

export async function getOrCreateUser(decoded: DecodedIdToken): Promise<UserDoc> {
  const userRef = adminDb.collection("users").doc(decoded.uid);
  const snapshot = await userRef.get();

  if (snapshot.exists) {
    return withLocalUnlimitedPlan(snapshot.data() as UserDoc);
  }

  const user: UserDoc = {
    userId: decoded.uid,
    email: decoded.email ?? "",
    plan: "free",
    createdAt: nowIso()
  };
  await userRef.set(user);
  return withLocalUnlimitedPlan(user);
}
