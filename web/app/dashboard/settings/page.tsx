"use client";

import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { SettingsPage } from "@/components/settings-page";
import { useAuth } from "@/components/auth-provider";
import { PlanName } from "@/types/domain";
import { PLANS } from "@/lib/plans";

interface MeResponse {
  userId: string;
  email: string;
  plan: PlanName;
  displayName?: string;
  workspaceName?: string;
  settings?: any; // To avoid type bloat here, just pass the object
  createdAt: string;
}

function aiMaxForPlan(plan: PlanName): number {
  if (plan === "starter") return 30;
  if (plan === "pro") return 200;
  if (plan === "business") return 800;
  return Number.MAX_SAFE_INTEGER;
}

export default function SettingsRoute() {
  const { apiFetch, token, user } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const res = await apiFetch("/api/me");
        if (res.ok) setMe((await res.json()) as MeResponse);
      } catch { /* silent */ }
    };
    void load();
  }, [apiFetch, token]);

  return (
    <DashboardShell>
      <div className="dashboard-main-padding">
        <div className="page-header">
          <div>
            <span className="page-eyebrow">Preferences</span>
            <h2 className="page-title">設定</h2>
            <p className="page-subtitle">
              アカウント・ワークスペース・監視・通知・AI・プランを管理します。
            </p>
          </div>
        </div>

        <SettingsPage
          me={me ? {
            displayName: me.displayName || user?.displayName || me.email.split("@")[0],
            email: me.email,
            plan: me.plan,
            workspaceName: me.workspaceName,
            settings: me.settings,
            sitesUsed: 3, // TODO: Wire these to actual usage counts
            sitesMax: PLANS[me.plan || "starter"]?.maxSites ?? 3,
            aiUsed: 15,
            aiMax: aiMaxForPlan(me.plan ?? "starter"),
          } : null}
        />
      </div>
    </DashboardShell>
  );
}
