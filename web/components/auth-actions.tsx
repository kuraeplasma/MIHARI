"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";

export function AuthActions() {
  const { user, loading, authError, signInWithGoogle, signOutUser } = useAuth();

  if (loading) {
    return <button className="btn btn-muted">Loading...</button>;
  }

  if (authError) {
    return (
      <div className="stack-sm">
        <p className="error-text">{authError}</p>
        <p className="tiny-copy">Set Firebase env values first, then reload this page.</p>
      </div>
    );
  }

  if (!user) {
    return (
      <button className="btn btn-primary" onClick={() => void signInWithGoogle()}>
        Sign in with Google
      </button>
    );
  }

  return (
    <div className="auth-inline">
      <span className="auth-email">{user.email}</span>
      <Link href="/dashboard" className="btn btn-primary">
        Dashboard
      </Link>
      <button className="btn btn-muted" onClick={() => void signOutUser()}>
        Sign out
      </button>
    </div>
  );
}
