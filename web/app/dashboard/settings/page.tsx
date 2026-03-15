"use client";

import { useCallback, useEffect, useState } from "react";
import { SettingsPage } from "@/components/settings-page";
import { useAuth } from "@/components/auth-provider";
import { PlanName, UserDoc } from "@/types/domain";
import { PLANS } from "@/lib/plans";

interface BillingHistoryItem {
  billingId: string;
  billedAt: string;
  description: string;
  amount: number | null;
  currency: "JPY";
  status: "scheduled" | "paid" | "failed";
  receiptUrl: string | null;
}

interface MeResponse {
  userId: string;
  email: string;
  plan: PlanName;
  displayName?: string;
  workspaceName?: string;
  billingCompanyName?: string;
  avatarDataUrl?: string | null;
  settings?: UserDoc["settings"];
  billing?: UserDoc["billing"];
  stripeSubscriptionId?: string | null;
  billingHistory?: BillingHistoryItem[];
  monthlyAiUsage?: number;
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
  const [siteCount, setSiteCount] = useState(0);

  const loadData = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const [meRes, sitesRes] = await Promise.all([apiFetch("/api/me"), apiFetch("/api/sites")]);
      if (meRes.ok) {
        setMe((await meRes.json()) as MeResponse);
      }
      if (sitesRes.ok) {
        const sitesData = (await sitesRes.json()) as { sites?: Array<unknown> };
        setSiteCount(sitesData.sites?.length ?? 0);
      }
    } catch {
      // Keep existing state and let pages show prior data.
    }
  }, [apiFetch, token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="dashboard-main-padding">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Preferences</span>
          <h2 className="page-title">設定</h2>
          <p className="page-subtitle">アカウント・ワークスペース・監視・通知・AI・プランを管理します。</p>
        </div>
      </div>

      <SettingsPage
        onProfileRefresh={loadData}
        me={
          me
            ? {
                displayName: me.displayName || user?.displayName || me.email.split("@")[0],
                email: me.email,
                plan: me.plan,
                workspaceName: me.workspaceName,
                billingCompanyName: me.billingCompanyName,
                avatarDataUrl: me.avatarDataUrl ?? null,
                settings: me.settings,
                billing: me.billing,
                stripeSubscriptionId: me.stripeSubscriptionId ?? null,
                billingHistory: me.billingHistory,
                sitesUsed: siteCount,
                sitesMax: PLANS[me.plan || "starter"]?.maxSites ?? 3,
                aiUsed: me.monthlyAiUsage ?? 0,
                aiMax: aiMaxForPlan(me.plan ?? "starter")
              }
            : null
        }
      />
    </div>
  );
}

