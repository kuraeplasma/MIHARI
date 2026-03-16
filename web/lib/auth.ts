import { NextRequest } from "next/server";
import { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth } from "@/lib/firebase-admin";

interface IdentityToolkitLookupResponse {
  users?: Array<{
    localId?: string;
    email?: string;
    displayName?: string;
    emailVerified?: boolean;
  }>;
}

function projectIdForFallback(): string {
  return (process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "").trim();
}

async function verifyViaIdentityToolkit(idToken: string): Promise<DecodedIdToken> {
  const apiKey = (process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new Error("Missing NEXT_PUBLIC_FIREBASE_API_KEY for fallback auth verification");
  }

  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken })
  });

  if (!res.ok) {
    throw new Error("Failed to verify Firebase token via Identity Toolkit");
  }

  const payload = (await res.json()) as IdentityToolkitLookupResponse;
  const user = payload.users?.[0];
  if (!user?.localId) {
    throw new Error("Invalid Firebase token");
  }

  const now = Math.floor(Date.now() / 1000);
  const projectId = projectIdForFallback();

  return {
    uid: user.localId,
    sub: user.localId,
    aud: projectId,
    iss: projectId ? `https://securetoken.google.com/${projectId}` : "",
    iat: now,
    exp: now + 3600,
    auth_time: now,
    email: user.email,
    email_verified: user.emailVerified ?? false,
    name: user.displayName,
    firebase: {
      identities: user.email ? { email: [user.email] } : {},
      sign_in_provider: "password"
    }
  } as DecodedIdToken;
}

export async function requireAuth(req: NextRequest): Promise<DecodedIdToken> {
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing bearer token");
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    return await adminAuth.verifyIdToken(token);
  } catch (adminError) {
    const hasApiKey = Boolean((process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "").trim());
    if (!hasApiKey) {
      throw adminError;
    }

    try {
      return await verifyViaIdentityToolkit(token);
    } catch (fallbackError) {
      // Preserve existing behavior for invalid/expired tokens when fallback cannot verify.
      throw adminError ?? fallbackError;
    }
  }
}
