"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { History, BarChart3, Globe, ArrowRight, AlertCircle } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatusPill } from "@/components/status-pill";
import { useAuth } from "@/components/auth-provider";
import { PlanName, SiteDoc } from "@/types/domain";

const USE_DEMO_JP_THUMBNAILS = true;
const JAPAN_DEMO_URLS = [
  "https://www.yahoo.co.jp/",
  "https://www.google.co.jp/",
  "https://www.youtube.com/",
  "https://www.amazon.co.jp/",
  "https://www.rakuten.co.jp/",
  "https://www.nhk.or.jp/",
  "https://www.nikkei.com/",
  "https://www.asahi.com/",
  "https://www.yomiuri.co.jp/",
  "https://mainichi.jp/",
  "https://www.jiji.com/",
  "https://www.itmedia.co.jp/",
  "https://www.impress.co.jp/",
  "https://gigazine.net/",
  "https://qiita.com/",
  "https://zenn.dev/",
  "https://b.hatena.ne.jp/",
  "https://cookpad.com/",
  "https://tabelog.com/",
  "https://www.hotpepper.jp/",
  "https://suumo.jp/",
  "https://www.homes.co.jp/",
  "https://www.mynavi.jp/",
  "https://doda.jp/",
  "https://jp.indeed.com/",
  "https://line.me/ja/",
  "https://paypay.ne.jp/",
  "https://www.smbc.co.jp/",
  "https://www.mufg.jp/",
  "https://www.japanpost.jp/",
  "https://jr-central.co.jp/",
  "https://www.ana.co.jp/",
  "https://www.jal.co.jp/",
  "https://www.nttdocomo.co.jp/",
  "https://www.softbank.jp/",
  "https://www.au.com/",
  "https://www.sony.co.jp/",
  "https://global.toyota/jp/",
  "https://www.nintendo.co.jp/",
  "https://weathernews.jp/",
  "https://news.yahoo.co.jp/",
  "https://www.mercari.com/jp/",
  "https://www.uniqlo.com/jp/ja/",
  "https://www.biccamera.com/",
  "https://www.zozo.jp/"
];

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
  try { return new URL(url).hostname; } catch { return url; }
}

function getSiteThumbnail(url: string) {
  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=160&h=100`;
}

function getSiteFavicon(url: string) {
  return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(url)}`;
}

function getDemoJapaneseSiteThumbnail(index: number) {
  return getSiteThumbnail(JAPAN_DEMO_URLS[index % JAPAN_DEMO_URLS.length]);
}

function getScoreColor(score: number) {
  if (score >= 80) return "var(--ok)";
  if (score >= 50) return "var(--warn)";
  return "var(--danger)";
}

export default function DashboardPage() {
  const { apiFetch, token } = useAuth();
  const [sites, setSites] = useState<SiteDoc[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [plan, setPlan] = useState<SitesResponse["plan"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [capacityView, setCapacityView] = useState<"thumb" | "list">("thumb");

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        setLoading(true);
        const [sitesRes, alertsRes] = await Promise.all([
          apiFetch("/api/sites"),
          apiFetch("/api/alerts"),
        ]);
        if (!sitesRes.ok) throw new Error("データの取得に失敗しました");
        const sitesPayload = (await sitesRes.json()) as SitesResponse;
        setSites(sitesPayload.sites);
        setPlan(sitesPayload.plan);
        if (alertsRes.ok) {
          const alertsPayload = (await alertsRes.json()) as AlertsResponse;
          setAlerts(alertsPayload.alerts);
        }
      } catch (e) {
        // --- Development Mock Data Fallback ---
        console.log("Using mock data due to API error:", e);
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        setPlan({
          name: "starter",
          maxSites: 3,
          intervalMinutes: 1,
          formMonitoring: true,
          aiAnalysis: true,
        });

        setSites([
          { siteId: "1", userId: "u1", clientId: null, url: "https://example.com/pricing", status: "healthy", healthScore: 98, lastCheckedAt: now.toISOString(), nextCheckAt: "", formMonitorEnabled: false, createdAt: "" },
          { siteId: "2", userId: "u1", clientId: null, url: "https://shop.client-a.jp", status: "degraded", healthScore: 65, lastCheckedAt: new Date(now.getTime() - 5 * 60000).toISOString(), nextCheckAt: "", formMonitorEnabled: true, createdAt: "" },
          { siteId: "3", userId: "u1", clientId: null, url: "https://corp.example.co.jp/contact", status: "down", healthScore: 12, lastCheckedAt: new Date(now.getTime() - 15 * 60000).toISOString(), nextCheckAt: "", formMonitorEnabled: true, createdAt: "" },
        ]);

        setAlerts([
          { alertId: "a1", siteId: "3", domain: "corp.example.co.jp", title: "フォーム送信エラー (500 Internal Server Error)", type: "form", createdAt: new Date(now.getTime() - 15 * 60000).toISOString(), resolved: false },
          { alertId: "a2", siteId: "2", domain: "shop.client-a.jp", title: "カートボタンのCSSレイアウト崩れ", type: "rendering", createdAt: new Date(now.getTime() - 2 * 3600000).toISOString(), resolved: false },
          { alertId: "a3", siteId: "1", domain: "example.com", title: "料金表画像のリンク切れ", type: "links", createdAt: yesterday.toISOString(), resolved: true },
        ]);

        setError(null); // モックデータを使用するためエラー表示は消す
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [apiFetch, token]);

  const summary = useMemo(() => ({
    total: sites.length,
    healthy: sites.filter(s => s.status === "healthy").length,
    errors: sites.filter(s => s.status === "down").length,
    warnings: sites.filter(s => s.status === "degraded").length,
    todayAlerts: alerts.filter(a => new Date(a.createdAt).toDateString() === new Date().toDateString()).length,
  }), [sites, alerts]);

  const heroSummary = useMemo(() => {
    if (summary.errors > 0) {
      return {
        text: `${summary.errors}件の重大エラーを検知しています。確認してください。`,
        color: "var(--danger)"
      };
    }
    if (summary.todayAlerts > 0 || summary.warnings > 0) {
      return {
        text: `直近24時間で${summary.todayAlerts}件の変更を検知しました。${summary.warnings}件の警告があります。`,
        color: "var(--warn)"
      };
    }
    return {
      text: "直近24時間、すべてのサイトは正常です。",
      color: "var(--ok)"
    };
  }, [summary]);

  const issuesSites = useMemo(
    () => sites.filter(s => s.status === "down" || s.status === "degraded").slice(0, 5),
    [sites]
  );

  const recentSites = useMemo(
    () => [...sites]
      .sort((a, b) => (b.lastCheckedAt ? new Date(b.lastCheckedAt).getTime() : 0) - (a.lastCheckedAt ? new Date(a.lastCheckedAt).getTime() : 0))
      .slice(0, 6),
    [sites]
  );

  const kpis = [
    {
      label: "監視サイト",
      value: summary.total,
      unit: "sites",
      trend: `正常 ${summary.healthy}`,
      trendUp: true,
      icon: <Globe size={18} style={{ color: "var(--emerald)" }} />,
      iconBg: "var(--emerald-glass)",
      delay: "animate-in animate-in-delay-1",
    },
    {
      label: "本日の変更検知",
      value: summary.todayAlerts,
      unit: "changes",
      trend: "直近24時間",
      trendUp: null,
      icon: <History size={18} style={{ color: "var(--emerald)" }} />,
      iconBg: "var(--emerald-glass)",
      delay: "animate-in animate-in-delay-2",
    },
    {
      label: "要確認リスク",
      value: summary.errors + summary.warnings,
      unit: "issues",
      trend: `重大エラー ${summary.errors}`,
      trendUp: summary.errors === 0,
      icon: <AlertCircle size={18} style={{ color: summary.errors > 0 ? "var(--warn)" : "var(--emerald)" }} />,
      iconBg: summary.errors > 0 ? "var(--warn-bg)" : "var(--emerald-glass)",
      danger: summary.errors > 0,
      delay: "animate-in animate-in-delay-3",
    },
    {
      label: "AI解析レポート",
      value: summary.healthy,
      unit: "reports",
      trend: "AI自動解析",
      trendUp: null,
      icon: <BarChart3 size={18} style={{ color: "var(--emerald)" }} />,
      iconBg: "var(--emerald-glass)",
      delay: "animate-in animate-in-delay-4",
    },
  ];

  const tickerItems = [
    `監視サイト ${summary.total} 件`,
    `正常 ${summary.healthy} 件`,
    `要確認 ${summary.errors + summary.warnings} 件`,
    `直近24h 変更検知 ${summary.todayAlerts} 件`,
    `プラン ${plan?.name ?? "starter"}`
  ];
  const tickerLoopItems = [...tickerItems, ...tickerItems];
  const sitePreviewPool = useMemo(() => JAPAN_DEMO_URLS, []);
  const siteWallItems = useMemo(
    () =>
      JAPAN_DEMO_URLS.map((url, idx) => {
        const status = idx % 11 === 0 ? "down" : idx % 4 === 0 ? "degraded" : "healthy";
        const score =
          status === "down" ? 10 + (idx % 18) : status === "degraded" ? 55 + (idx % 18) : 90 + (idx % 10);
        const unresolved = status !== "healthy" && idx % 3 !== 0;
        const title = status === "down" ? "接続エラーを検知" : status === "degraded" ? "応答遅延を検知" : "監視中";
        return { url, status, score, unresolved, title };
      }),
    []
  );
  const planCapacity = [
    { key: "starter", label: "Starter", max: 3 },
    { key: "pro", label: "Pro", max: 15 },
    { key: "business", label: "Business", max: 40 },
  ] as const;

  return (
    <DashboardShell>
      <div className="dashboard-main-padding dashboard-live dashboard-expanded">

        {/* Error */}
        {error && (
          <div className="data-panel animate-in" style={{ borderColor: "var(--danger)", background: "var(--danger-bg)" }}>
            <div style={{ padding: "1rem 1.5rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <AlertCircle size={16} style={{ color: "var(--danger)", flexShrink: 0 }} />
              <p style={{ color: "var(--danger)", fontSize: "0.875rem" }}>{error}</p>
            </div>
          </div>
        )}

        {/* Welcome Panel - Nested Monitor Frame (Recessed Screen) */}
        <section className={`hero-monitor-outer animate-in`}>
          <div className={`hero-monitor-inner ${heroSummary.color === "var(--danger)" ? "alert" :
            heroSummary.color === "var(--warn)" ? "warning" : "stable"
            } pipboy-monitor`}>
            {/* CRT Effects */}
            <div className="monitor-vignette" />

            <div className="monitor-content">
              <div style={{ flex: 1 }}>
                <p style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  opacity: 0.6,
                  marginBottom: "0.6rem",
                  color: heroSummary.color
                }}>
                  SYSTEM_STATUS_MONITOR // {heroSummary.color === "var(--danger)" ? "ALERT" : "NORMAL"}
                </p>
                <h2 className="welcome-title monitor-text" style={{
                  fontSize: "1.375rem",
                  color: heroSummary.color,
                  marginBottom: 0,
                  lineHeight: "1.2",
                  fontWeight: 800,
                  wordBreak: "keep-all"
                }}>
                  {">"} {heroSummary.text}
                </h2>
              </div>

              <div className="welcome-actions" style={{
                marginTop: 0,
                position: "relative",
                zIndex: 10,
                display: "flex",
                gap: "0.875rem",
                flexShrink: 0
              }}>
                <Link href="/dashboard/sites" className="btn monitor-btn monitor-btn-primary" style={{
                  padding: "0.75rem 1.75rem",
                  borderRadius: "6px"
                }}>
                  監視一覧へ
                </Link>
                <Link href="/dashboard/alerts" className="btn monitor-btn monitor-btn-ghost" style={{
                  padding: "0.75rem 1.75rem",
                  borderRadius: "6px"
                }}>
                  アラートを検証
                </Link>
              </div>
            </div>

            <div className="monitor-ticker-dock" aria-label="運用ティッカー">
              <div className="ops-ticker-wrap">
                <div className="ops-ticker-track">
                  <div className="ops-ticker-group">
                    {tickerLoopItems.map((item, idx) => (
                      <span key={`ticker-a-${idx}`} className="ops-ticker-item">
                        {item}
                      </span>
                    ))}
                  </div>
                  <div className="ops-ticker-group" aria-hidden="true">
                    {tickerLoopItems.map((item, idx) => (
                      <span key={`ticker-b-${idx}`} className="ops-ticker-item">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* KPI Grid */}
        <div className="kpi-grid">
          {kpis.map(kpi => (
            <article key={kpi.label} className={`kpi-card ${kpi.delay}`}>
              <div className="kpi-top">
                <div className="kpi-meta">
                  <p className="kpi-label">{kpi.label}</p>
                </div>
                <div className="kpi-icon-wrap" style={{
                  background: kpi.iconBg, padding: "6px", borderRadius: "8px"
                }}>
                  {kpi.icon}
                </div>
              </div>
              <div>
                <div>
                  <span className="kpi-value">
                    {loading ? "—" : kpi.value}
                  </span>
                  <span className="kpi-unit">{kpi.unit}</span>
                </div>
                <div className={`kpi-trend`} style={{ color: kpi.danger ? "var(--warn)" : kpi.trendUp ? "var(--ok)" : "var(--text-4)" }}>
                  {kpi.trend}
                </div>
              </div>
            </article>
          ))}
        </div>

        <section className="data-panel animate-in animate-in-delay-2" style={{ marginTop: "1rem" }}>
          <div className="panel-header">
            <div>
              <h3 className="panel-title">プラン別サイト収容ビュー（3 / 15 / 40）</h3>
              <p className="page-subtitle" style={{ marginTop: "0.2rem" }}>
                サムネイル表示とリスト表示を切り替えて、各プランの見え方を検証できます。
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button
                type="button"
                className={`btn btn-xs ${capacityView === "thumb" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setCapacityView("thumb")}
              >
                サムネイル
              </button>
              <button
                type="button"
                className={`btn btn-xs ${capacityView === "list" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setCapacityView("list")}
              >
                リスト
              </button>
            </div>
          </div>
          <div className="plan-capacity-grid">
            {planCapacity.map((planItem) => {
              const used = planItem.max;
              const slots = Array.from({ length: planItem.max }, (_, idx) => idx);
              return (
                <article key={planItem.key} className="plan-capacity-card">
                  <div className="plan-capacity-head">
                    <p className="plan-capacity-name">{planItem.label}</p>
                    <p className="plan-capacity-count">{used} / {planItem.max}</p>
                  </div>
                  {capacityView === "thumb" ? (
                    <div className={`plan-slot-grid plan-slot-grid-${planItem.max}`}>
                      {slots.map((slot) => {
                        const occupied = slot < used;
                        const item = siteWallItems[slot % siteWallItems.length];
                        return occupied ? (
                          <div key={slot} className="plan-slot-thumb">
                            <img
                              src={getSiteThumbnail(item.url)}
                              alt={`${getDomain(item.url)} thumbnail`}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                const el = e.currentTarget;
                                if (el.dataset.fallbackApplied === "1") return;
                                el.dataset.fallbackApplied = "1";
                                el.src = getSiteFavicon(item.url);
                                el.style.objectFit = "contain";
                                el.style.padding = "5px";
                              }}
                            />
                            <div className="plan-thumb-overlay">
                              <span className={`plan-thumb-lamp ${item.status}`} aria-hidden="true" />
                              <div className="plan-thumb-top">
                                <span className="plan-thumb-domain">{getDomain(item.url)}</span>
                                <span className={`plan-thumb-chip score ${item.status}`}>{item.score}</span>
                              </div>
                              <div className="plan-thumb-meta">
                                {item.unresolved && <span className="plan-thumb-chip unresolved">未解消</span>}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div key={slot} className="plan-slot-empty" aria-label="空きスロット" />
                        );
                      })}
                    </div>
                  ) : (
                    <ul className="plan-list-monitor">
                      {slots.map((slot) => {
                        const occupied = slot < used;
                        const item = siteWallItems[slot % siteWallItems.length];
                        return (
                          <li key={slot} className={`plan-monitor-row ${occupied ? "filled" : "empty"}`}>
                            {occupied ? (
                              <>
                                <div className="plan-monitor-head">
                                  <p className="plan-monitor-domain">{getDomain(item.url)}</p>
                                  <span className={`plan-monitor-status ${item.status}`}>
                                    {item.status === "down" ? "停止" : item.status === "degraded" ? "警告" : "正常"}
                                  </span>
                                  <span className={`plan-monitor-score ${item.status}`}>{item.score}</span>
                                </div>
                                <div className="plan-mini-bar-wrap">
                                  <div className="plan-mini-bar-track">
                                    <div className="plan-mini-bar-fill" style={{ width: `${item.score}%` }} />
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="plan-monitor-empty">空きスロット #{slot + 1}</div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {/* Split Grid */}
        <div className="split-grid">
          {/* Issues */}
          <section className="data-panel animate-in">
            <div className="panel-header">
              <h3 className="panel-title">異常を検知しているサイト</h3>
              <Link href="/dashboard/alerts" className="btn btn-ghost btn-xs" style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                すべて見る <ArrowRight size={12} />
              </Link>
            </div>
            {loading ? (
              <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: "52px", borderRadius: "10px" }} />)}
              </div>
            ) : issuesSites.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <Globe size={22} style={{ color: "var(--ok)" }} />
                </div>
                <p className="empty-title">すべて正常です</p>
                <p className="empty-body">現在、異常を検知しているサイトはありません。</p>
              </div>
            ) : (
              <div className="card-list">
                {issuesSites.map((site, idx) => {
                  const latestAlert = alerts.find(a => a.siteId === site.siteId);
                  const alertTitle = latestAlert ? latestAlert.title : site.status === "down" ? "サイトがダウンしています" : "レスポンス低下中";
                  const isUnresolved = latestAlert ? !latestAlert.resolved : true;

                  return (
                    <div key={site.siteId} className="list-row issues-row" style={{ alignItems: "center" }}>
                      <div className={`issue-thumb issue-thumb-monitor ${site.status === "down" ? "down" : "warn"}`}>
                        <img
                          src={USE_DEMO_JP_THUMBNAILS ? getDemoJapaneseSiteThumbnail(idx) : getSiteThumbnail(site.url)}
                          alt={`${getDomain(site.url)} thumbnail`}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="issue-thumb-img"
                          onError={(e) => {
                            const el = e.currentTarget;
                            if (el.dataset.fallbackApplied === "1") return;
                            el.dataset.fallbackApplied = "1";
                            el.src = getSiteFavicon(site.url);
                            el.style.objectFit = "contain";
                            el.style.padding = "10px";
                          }}
                        />
                        <div className="issue-thumb-overlay">
                          <div className="issue-thumb-head">
                            <p className="issue-thumb-domain">{getDomain(site.url)}</p>
                            <span className={`issue-chip score ${site.status === "down" ? "down" : "warn"}`}>{site.healthScore}</span>
                          </div>
                          <p className="issue-thumb-title">{alertTitle}</p>
                          <div className="issue-thumb-footer">
                            <span className={`issue-chip status ${site.status === "down" ? "down" : "warn"}`}>
                              {site.status === "down" ? "停止" : "警告"}
                            </span>
                            {isUnresolved && (
                              <span className="issue-chip unresolved">未解消</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Recent checks */}
          <aside className="data-panel animate-in animate-in-delay-1">
            <div className="panel-header">
              <h3 className="panel-title">最新チェック状況</h3>
            </div>
            {loading ? (
              <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: "40px", borderRadius: "8px" }} />)}
              </div>
            ) : recentSites.length === 0 ? (
              <div className="empty-state" style={{ padding: "2.5rem" }}>
                <p className="empty-body">サイトが登録されていません。</p>
              </div>
            ) : (
              <div className="card-list">
                {recentSites.map(site => (
                  <Link key={site.siteId} href={`/dashboard/sites/${site.siteId}`} className="list-row" style={{ textDecoration: "none" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <p className="row-primary truncate">{getDomain(site.url)}</p>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: site.status === "down" ? "var(--danger)" : site.status === "degraded" ? "var(--warn)" : "var(--ok)" }}>
                          {site.status === "down" ? "停止" : site.status === "degraded" ? "警告" : "正常"}
                        </span>
                      </div>
                      <div className="score-bar-wrap liquid-meter-wrap" style={{ marginTop: "0.4rem" }}>
                        <div className="score-bar-track">
                          <div className="score-bar-fill" style={{
                            width: `${site.healthScore}%`
                          }} />
                        </div>
                      </div>
                    </div>
                    <div style={{
                      fontSize: "0.875rem",
                      fontWeight: 800,
                      color: site.status === "down" ? "var(--danger)" : site.status === "degraded" ? "var(--warn)" : "var(--ok)"
                    }}>{site.healthScore}</div>
                  </Link>
                ))}
              </div>
            )}
          </aside>
        </div>

      </div>
    </DashboardShell>
  );
}
