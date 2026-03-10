"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatusPill } from "@/components/status-pill";
import { useAuth } from "@/components/auth-provider";
import { PlanName, SiteDoc } from "@/types/domain";

interface SitesResponse {
  sites: SiteDoc[];
  plan: {
    name: PlanName;
    maxSites: number;
    intervalMinutes: number;
    formMonitoring: boolean;
    aiAnalysis: boolean;
  };
}

interface AlertRow {
  alertId: string;
  siteId: string;
  domain: string;
  title: string;
  type: string;
  createdAt: string;
  resolved: boolean;
}

interface AlertsResponse {
  alerts: AlertRow[];
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function getIssueLabel(site: SiteDoc, alerts: AlertRow[]) {
  const alert = alerts.find((item) => item.siteId === site.siteId);
  if (alert?.title) {
    return alert.title;
  }
  if (site.status === "down") {
    return "HTTPまたはフォーム監視で致命的なエラーを検知";
  }
  return "監視結果に警告があります";
}

export default function DashboardPage() {
  const { apiFetch, token } = useAuth();
  const [sites, setSites] = useState<SiteDoc[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [plan, setPlan] = useState<SitesResponse["plan"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [sitesRes, alertsRes] = await Promise.all([apiFetch("/api/sites"), apiFetch("/api/alerts")]);
        if (!sitesRes.ok) {
          throw new Error("Failed to fetch dashboard data");
        }
        const sitesPayload = (await sitesRes.json()) as SitesResponse;
        setSites(sitesPayload.sites);
        setPlan(sitesPayload.plan);

        if (alertsRes.ok) {
          const alertsPayload = (await alertsRes.json()) as AlertsResponse;
          setAlerts(alertsPayload.alerts);
        } else {
          setAlerts([]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [apiFetch, token]);

  const summary = useMemo(() => {
    const total = sites.length;
    const errors = sites.filter((site) => site.status === "down").length;
    const warnings = sites.filter((site) => site.status === "degraded" || site.status === "pending").length;
    const healthy = sites.filter((site) => site.status === "healthy").length;
    return { total, errors, warnings, healthy };
  }, [sites]);

  const activeIssues = useMemo(
    () => sites.filter((site) => site.status === "down" || site.status === "degraded"),
    [sites]
  );

  const recentSites = useMemo(
    () =>
      [...sites]
        .sort((a, b) => (b.lastCheckedAt ? new Date(b.lastCheckedAt).getTime() : 0) - (a.lastCheckedAt ? new Date(a.lastCheckedAt).getTime() : 0))
        .slice(0, 5),
    [sites]
  );

  return (
    <DashboardShell>
      <section className="panel hero-panel">
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Dashboard Overview</p>
            <h3>制作会社が複数顧客の監視状況をすぐ判断できる運用画面へ再構成しました。</h3>
            <p>
              監視サイト数、異常件数、警告件数、最新の障害状況を一画面に集約しています。運用担当者はこの画面から
              顧客別管理とサイト詳細へすぐ遷移できます。
            </p>
            <div className="auth-inline">
              <Link className="btn btn-primary" href="/dashboard/sites">
                サイト一覧へ
              </Link>
              <Link className="btn btn-muted" href="/dashboard/customers">
                顧客管理へ
              </Link>
            </div>
          </div>

          <div className="panel hero-plan">
            <div className="section-stack">
              <p className="eyebrow">Current Plan</p>
              <strong>{plan?.name ?? "loading"}</strong>
              <p className="tiny-copy">
                最大 {plan?.maxSites ?? "-"} サイト / {plan?.intervalMinutes ?? "-"} 分ごとの監視
              </p>
            </div>
            <div className="hero-plan-grid">
              <div className="kpi-tag">
                <span className={`status-dot ${plan?.formMonitoring ? "healthy" : "warning"}`} />
                フォーム監視 {plan?.formMonitoring ? "ON" : "OFF"}
              </div>
              <div className="kpi-tag">
                <span className={`status-dot ${plan?.aiAnalysis ? "healthy" : "warning"}`} />
                AI分析 {plan?.aiAnalysis ? "ON" : "OFF"}
              </div>
            </div>
          </div>
        </div>
      </section>

      {error && <p className="error-text">{error}</p>}
      {loading && <p>Loading dashboard...</p>}

      {!loading && (
        <>
          <section className="summary-grid">
            <article className="summary-card">
              <p className="tiny-copy">監視サイト数</p>
              <div className="summary-card-value">
                <strong>{summary.total}</strong>
                <span>sites</span>
              </div>
              <div className="status-inline">
                <span className="status-dot healthy" />
                正常 {summary.healthy} 件
              </div>
            </article>
            <article className="summary-card status-error">
              <p className="tiny-copy">エラーサイト数</p>
              <div className="summary-card-value">
                <strong>{summary.errors}</strong>
                <span>critical</span>
              </div>
              <div className="status-inline">
                <span className="status-dot error" />
                即時対応が必要
              </div>
            </article>
            <article className="summary-card status-warning">
              <p className="tiny-copy">警告サイト数</p>
              <div className="summary-card-value">
                <strong>{summary.warnings}</strong>
                <span>warnings</span>
              </div>
              <div className="status-inline">
                <span className="status-dot warning" />
                影響拡大前の確認対象
              </div>
            </article>
          </section>

          <section className="panel-subgrid">
            <section className="panel">
              <div className="section-head">
                <div className="section-head-copy">
                  <h3>現在エラーが発生しているサイト</h3>
                  <p className="tiny-copy">障害または警告が発生しているサイトを優先度順に表示します。</p>
                </div>
                <Link href="/dashboard/alerts" className="btn btn-muted btn-xs">
                  アラート一覧
                </Link>
              </div>

              {activeIssues.length === 0 ? (
                <div className="empty-state">現在エラーサイトはありません。</div>
              ) : (
                <div className="card-list">
                  {activeIssues.map((site) => (
                    <article key={site.siteId} className="issue-row">
                      <div className="section-stack">
                        <Link href={`/dashboard/sites/${site.siteId}`} className="mono-link issue-title">
                          {getDomain(site.url)}
                        </Link>
                        <p className="tiny-copy">{getIssueLabel(site, alerts)}</p>
                        <div className="issue-meta">
                          <span>Health {site.healthScore}</span>
                          <span>
                            最終チェック {site.lastCheckedAt ? new Date(site.lastCheckedAt).toLocaleString() : "未実行"}
                          </span>
                        </div>
                      </div>
                      <StatusPill status={site.status} />
                    </article>
                  ))}
                </div>
              )}
            </section>

            <aside className="panel">
              <div className="section-head-copy">
                <h3>最新チェック</h3>
                <p className="tiny-copy">最近チェックされたサイトの状態です。</p>
              </div>
              {recentSites.length === 0 ? (
                <div className="empty-state">サイトが登録されていません。</div>
              ) : (
                <div className="card-list">
                  {recentSites.map((site) => (
                    <article key={site.siteId} className="overview-card">
                      <div className="overview-card-row">
                        <Link href={`/dashboard/sites/${site.siteId}`} className="mono-link">
                          {getDomain(site.url)}
                        </Link>
                        <StatusPill status={site.status} />
                      </div>
                      <div className="overview-card-row">
                        <span>Health score</span>
                        <strong>{site.healthScore}</strong>
                      </div>
                      <div className="overview-card-row">
                        <span>Last check</span>
                        <span>{site.lastCheckedAt ? new Date(site.lastCheckedAt).toLocaleString() : "未実行"}</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </aside>
          </section>
        </>
      )}
    </DashboardShell>
  );
}
