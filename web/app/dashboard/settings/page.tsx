"use client";

import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/components/auth-provider";
import { PlanName } from "@/types/domain";

interface MeResponse {
  userId: string;
  email: string;
  plan: PlanName;
  createdAt: string;
}

export default function SettingsPage() {
  const { apiFetch, token } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiFetch("/api/me");
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error ?? "Failed to load account");
        }
        setMe((await res.json()) as MeResponse);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [apiFetch, token]);

  return (
    <DashboardShell>
      <section className="panel">
        <div className="section-head-copy">
          <h3>設定</h3>
          <p className="tiny-copy">アカウント情報と監視プランの運用前提を確認できます。</p>
        </div>
      </section>

      {loading && <p>Loading settings...</p>}
      {error && <p className="error-text">{error}</p>}

      {me && (
        <section className="settings-grid">
          <article className="panel">
            <div className="section-head-copy">
              <h3>アカウント</h3>
              <p className="tiny-copy">ログイン中ユーザーの基本情報です。</p>
            </div>
            <div className="card-list">
              <div className="overview-card-row">
                <span>メールアドレス</span>
                <strong>{me.email}</strong>
              </div>
              <div className="overview-card-row">
                <span>プラン</span>
                <strong>{me.plan}</strong>
              </div>
              <div className="overview-card-row">
                <span>登録日</span>
                <strong>{new Date(me.createdAt).toLocaleString()}</strong>
              </div>
            </div>
          </article>

          <article className="panel">
            <div className="section-head-copy">
              <h3>監視ポリシー</h3>
              <p className="tiny-copy">現在のプランに応じた監視仕様です。</p>
            </div>
            <div className="card-list">
              <div className="overview-card-row">
                <span>監視間隔</span>
                <strong>プラン設定に準拠</strong>
              </div>
              <div className="overview-card-row">
                <span>フォーム監視 / AI分析</span>
                <strong>{me.plan === "free" ? "一部制限あり" : "利用可能"}</strong>
              </div>
              <div className="overview-card-row">
                <span>データ管理</span>
                <strong>Firestore ベース</strong>
              </div>
            </div>
          </article>
        </section>
      )}
    </DashboardShell>
  );
}
