"use client";

import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) {
      return;
    }
    if (user) {
      router.replace("/dashboard");
      return;
    }
    router.replace("/login");
  }, [loading, router, user]);

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <h1>Loading...</h1>
      </section>
    </main>
  );
}
