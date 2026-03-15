import { DecodedIdToken } from "firebase-admin/auth";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth as verifyAuth } from "@/lib/auth";

export type AuthGuardSuccess = {
  user: DecodedIdToken;
  error: null;
};

export type AuthGuardFailure = {
  user: null;
  error: NextResponse;
};

export type AuthGuardResult = AuthGuardSuccess | AuthGuardFailure;

export async function requireAuth(request: NextRequest): Promise<AuthGuardResult> {
  try {
    const user = await verifyAuth(request);
    return { user, error: null };
  } catch {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }
}
