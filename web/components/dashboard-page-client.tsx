"use client";

import Link from "next/link";
import { DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { LayoutGrid, List, Maximize2 } from "lucide-react";
import SiteThumbnailImage from "@/components/site-thumbnail-image";
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

interface WallItem {
  siteId: string;
  url: string;
  status: SiteDoc["status"];
  score: number;
}

function getDomain(url: string) {
  try { return new URL(url).hostname; } catch { return url; }
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}分前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}時間前`;
  return `${Math.floor(hrs / 24)}日前`;
}

function normalizedWallPlanMax(maxSites: number | undefined): 3 | 15 | 40 {
  if (maxSites === 3 || maxSites === 15) return maxSites;
  return 40;
}

export default function DashboardPage() {
  const { apiFetch, token } = useAuth();
  const [sites, setSites] = useState<SiteDoc[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [plan, setPlan] = useState<SitesResponse["plan"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [capacityView, setCapacityView] = useState<"thumb" | "list">("thumb");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; slot: number } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        setLoading(true);
        const [sitesRes, alertsRes] = await Promise.all([
          apiFetch("/api/sites"),
          apiFetch("/api/alerts?unresolved=1"),
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
        console.error("Failed to fetch dashboard data:", e);
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

  const expiryAlerts = useMemo(
    () => alerts.filter((a) => a.type === "ssl" || a.type === "domain").slice(0, 4),
    [alerts]
  );

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
  const heroStatus = heroSummary.color === "var(--danger)"
    ? "alert"
    : heroSummary.color === "var(--warn)"
      ? "warning"
      : "stable";
  const planMax = normalizedWallPlanMax(plan?.maxSites);
  const planLabel = plan ? plan.name.toUpperCase() : "LOADING";

  const kpis = [
    {
      symbol: "[~]",
      label: "監視サイト",
      value: summary.total,
      delay: "animate-in animate-in-delay-1",
    },
    {
      symbol: "[>]",
      label: "変更検知",
      value: summary.todayAlerts,
      delay: "animate-in animate-in-delay-2",
    },
    {
      symbol: "[!]",
      label: "要確認リスク",
      value: summary.errors + summary.warnings,
      delay: "animate-in animate-in-delay-3",
    },
    {
      symbol: "[*]",
      label: "AI解析",
      value: summary.healthy,
      delay: "animate-in animate-in-delay-4",
    },
  ];

  const tickerItems = [
    `監視サイト ${summary.total} 件`,
    `正常 ${summary.healthy} 件`,
    `要確認 ${summary.errors + summary.warnings} 件`,
    `直近24h 変更検知 ${summary.todayAlerts} 件`,
    `プラン ${planLabel}`
  ];
  const tickerLoopItems = [...tickerItems, ...tickerItems];
  const baseWallItems = useMemo(
    () =>
      Array.from({ length: planMax }, (_, i): WallItem => {
        const s = sites[i];
        if (s) {
          return {
            siteId: s.siteId,
            url: s.url,
            status: s.status,
            score: s.healthScore ?? 0
          };
        }
        return {
          siteId: "",
          url: "",
          status: "pending",
          score: 0
        };
      }),
    [planMax, sites]
  );
  const [wallItems, setWallItems] = useState(baseWallItems);
  const [draggedSlot, setDraggedSlot] = useState<number | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

  useEffect(() => {
    setWallItems(baseWallItems);
  }, [baseWallItems]);

  const slots = Array.from({ length: planMax }, (_, idx) => idx);
  const fullscreenPlan = planMax;
  const openThumbnailFullscreen = () => {
    window.open(`/wall-thumbnails?plan=${fullscreenPlan}`, "_blank", "noopener,noreferrer");
  };
  const handleThumbDragStart = (e: DragEvent<HTMLAnchorElement>, from: number) => {
    setDraggedSlot(from);
    setDragOverSlot(from);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(from));
  };
  const handleThumbDragOver = (e: DragEvent<HTMLAnchorElement>, over: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverSlot !== over) {
      setDragOverSlot(over);
    }
  };
  const handleThumbDrop = (e: DragEvent<HTMLAnchorElement>, to: number) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("text/plain");
    const from = raw ? Number(raw) : draggedSlot;
    if (from == null || Number.isNaN(from) || from === to) {
      setDraggedSlot(null);
      setDragOverSlot(null);
      return;
    }
    setWallItems((prev) => {
      if (from < 0 || from >= prev.length || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDraggedSlot(null);
    setDragOverSlot(null);
  };
  const handleThumbDragEnd = () => {
    setDraggedSlot(null);
    setDragOverSlot(null);
  };
  const handleThumbContextMenu = (e: React.MouseEvent<HTMLAnchorElement>, slot: number) => {
    e.preventDefault();
    const menuWidth = 320;
    const menuHeight = 220;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 12);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 12);
    setContextMenu({ x: Math.max(8, x), y: Math.max(8, y), slot });
    setCopiedUrl(null);
  };

  useEffect(() => {
    if (!contextMenu) return;
    const closeOnOutside = (ev: MouseEvent) => {
      const target = ev.target as Node | null;
      if (contextMenuRef.current && target && contextMenuRef.current.contains(target)) return;
      setContextMenu(null);
    };
    const closeOnEsc = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setContextMenu(null);
    };
    const closeOnViewportChange = () => setContextMenu(null);
    window.addEventListener("mousedown", closeOnOutside);
    window.addEventListener("keydown", closeOnEsc);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);
    return () => {
      window.removeEventListener("mousedown", closeOnOutside);
      window.removeEventListener("keydown", closeOnEsc);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, [contextMenu]);

  useEffect(() => {
    const prevBodyOverflowY = document.body.style.overflowY;
    const prevHtmlOverflowY = document.documentElement.style.overflowY;

    document.body.style.overflowY = "hidden";
    document.documentElement.style.overflowY = "hidden";

    return () => {
      document.body.style.overflowY = prevBodyOverflowY;
      document.documentElement.style.overflowY = prevHtmlOverflowY;
    };
  }, []);

  const contextItem = contextMenu ? wallItems[contextMenu.slot] : null;

  return (
      <div className="dashboard-page dashboard-main-padding">
        <div className="dashboard-live dashboard-expanded">

        <div className="monitor-wall-system animate-in">
          {/* Welcome Panel - Nested Monitor Frame (Recessed Screen) */}
          <section className={`hero-monitor-outer`}>
            <div className={`hero-monitor-inner ${heroStatus} pipboy-monitor`}>
              {/* CRT Effects */}
              <div className="monitor-vignette" />

              <div className="monitor-content">
                <div className="monitor-status-header">
                  <span className="monitor-status-label" style={{ color: heroSummary.color }}>
                    STATUS_SUMMARY // LIVE_FEED
                  </span>
                  <h2 className="welcome-title monitor-text">
                    {">"} {heroSummary.text}
                  </h2>
                </div>

                <div className="welcome-actions">
                  <Link href="/dashboard/sites" className="btn monitor-btn monitor-btn-primary monitor-btn-sites">
                    監視一覧へ
                  </Link>
                  {heroStatus === "warning" && (
                    <Link href="/dashboard/alerts" className="btn monitor-btn monitor-btn-ghost">
                      アラートを検証
                    </Link>
                  )}
                  {heroStatus === "alert" && (
                    <Link href="/dashboard/alerts" className="btn monitor-btn monitor-btn-alert-danger">
                      アラートを検証
                    </Link>
                  )}
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

          {/* KPI Grid - Now integrated INSIDE the monitor wall */}
          <div className="kpi-grid-monitor">
            {kpis.map(kpi => (
              <article key={kpi.label} className={`kpi-card-monitor ${kpi.delay}`}>
                <div className="kpi-monitor-body">
                  <div className="kpi-monitor-head">
                    <span className="kpi-monitor-symbol">{kpi.symbol}</span>
                    <p className="kpi-monitor-label">{kpi.label}</p>
                  </div>
                  <div className="kpi-monitor-val-wrap">
                    <span
                      className={`kpi-monitor-value ${
                        String(loading ? "—" : kpi.value).length >= 4
                          ? "digits-4plus"
                          : String(loading ? "—" : kpi.value).length >= 3
                            ? "digits-3"
                            : ""
                      }`}
                    >
                      {loading ? "—" : kpi.value}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <section className="monitor-grid-sub-area">
            <div className="monitor-view-switcher-wrap">
              <div className="monitor-view-controls">
                <div className="monitor-view-toggle monitor-view-button-group" role="group" aria-label="表示切替">
                  <button
                    type="button"
                    className={`monitor-fullscreen-btn monitor-view-btn ${capacityView === "thumb" ? "active" : ""}`}
                    onClick={() => setCapacityView("thumb")}
                    title="THUMBNAIL VIEW"
                    aria-pressed={capacityView === "thumb"}
                  >
                    <LayoutGrid size={16} />
                  </button>
                  <button
                    type="button"
                    className={`monitor-fullscreen-btn monitor-view-btn ${capacityView === "list" ? "active" : ""}`}
                    onClick={() => setCapacityView("list")}
                    title="LIST VIEW"
                    aria-pressed={capacityView === "list"}
                  >
                    <List size={16} />
                  </button>
                </div>
                <button
                  type="button"
                  className="monitor-fullscreen-btn"
                  onClick={openThumbnailFullscreen}
                  title="THUMBNAIL FULLSCREEN"
                  aria-label="サムネイルを全画面で開く"
                >
                  <Maximize2 size={15} />
                </button>
              </div>
            </div>
            <div className="plan-capacity-grid">
              <article className="plan-capacity-inner-wall">
                {capacityView === "thumb" ? (
                  <div className={`plan-slot-grid plan-slot-grid-${planMax}`}>
                    {slots.map((slot) => {
                      const item = wallItems[slot];
                      if (!item.siteId) {
                        return <div key={slot} className="plan-slot-thumb empty" aria-label={`空きスロット ${slot + 1}`} />;
                      }
                      return (
                        <Link
                          key={slot}
                          href={`/dashboard/sites/${item.siteId}`}
                          className={`plan-slot-thumb ${item.status} ${draggedSlot === slot ? "dragging" : ""} ${dragOverSlot === slot ? "drag-over" : ""}`}
                          draggable
                          onDragStart={(e) => handleThumbDragStart(e, slot)}
                          onDragOver={(e) => handleThumbDragOver(e, slot)}
                          onDrop={(e) => handleThumbDrop(e, slot)}
                          onDragEnd={handleThumbDragEnd}
                          onContextMenu={(e) => handleThumbContextMenu(e, slot)}
                        >
                          <SiteThumbnailImage
                            url={item.url}
                            alt={`${getDomain(item.url)} thumbnail`}
                          />
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <ul className="plan-list-monitor">
                    {slots.map((slot) => {
                      const item = wallItems[slot];
                      const occupied = Boolean(item.siteId);
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
                              <p className="plan-monitor-note">
                                SYS.LOG // CAPTURE PIPELINE ACTIVE // OCR CHECK QUEUED
                              </p>
                              <div className="plan-mini-bar-wrap">
                                <div className="plan-mini-bar-track">
                                  <div className="plan-mini-bar-fill" style={{ width: `${item.score}%` }} />
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="plan-monitor-empty">
                              <div>空きスロット #{slot + 1}</div>
                              <div className="plan-monitor-note">NO SIGNAL // STANDBY CHANNEL</div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </article>
            </div>
          </section>

          {expiryAlerts.length > 0 && (
            <section style={{ padding: "0 0.75rem 0.75rem" }}>
              <div style={{ border: "1px solid rgba(93,255,130,0.28)", borderRadius: "10px", background: "rgba(3,20,8,0.62)", padding: "0.55rem 0.75rem" }}>
                <p style={{ fontSize: "0.72rem", color: "#8ef7b7", fontWeight: 700, marginBottom: "0.4rem", letterSpacing: "0.06em" }}>異常を検知しているサイト</p>
                <div style={{ display: "grid", gap: "0.4rem" }}>
                  {expiryAlerts.map((alert) => (
                    <Link key={alert.alertId} href={"/dashboard/sites/" + alert.siteId} style={{ display: "block", color: "#c9ffe0", textDecoration: "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", fontWeight: 700 }}>
                        <span>🌐 {alert.domain} [{alert.type}] 未解消</span>
                        <span style={{ opacity: 0.75 }}>{relativeTime(alert.createdAt)}</span>
                      </div>
                      <p style={{ marginTop: "0.1rem", fontSize: "0.76rem", color: "#a2eec2" }}>{alert.title}</p>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
        </div>
        {contextMenu && contextItem && (
          <div
            ref={contextMenuRef}
            className="thumb-context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            role="dialog"
            aria-label="サイト詳細メニュー"
          >
            <div className="thumb-context-head">
              <div className="thumb-context-status-wrap">
                <span className={`thumb-context-status-dot ${contextItem.status}`} />
                <span className="thumb-context-status-label">
                  {contextItem.status === "down" ? "停止" : contextItem.status === "degraded" ? "警告" : "正常"}
                </span>
              </div>
              <span className={`thumb-context-score ${contextItem.status}`}>Score {contextItem.score}</span>
            </div>
            <p className="thumb-context-domain">{getDomain(contextItem.url)}</p>
            <p className="thumb-context-url">{contextItem.url}</p>
            <div className="thumb-context-actions">
              <Link
                href={`/dashboard/sites/${contextItem.siteId}`}
                className="thumb-context-btn"
                onClick={() => setContextMenu(null)}
              >
                サイト詳細を開く
              </Link>
              <button
                type="button"
                className="thumb-context-btn"
                onClick={() => window.open(contextItem.url, "_blank", "noopener,noreferrer")}
              >
                監視URLを新規タブで開く
              </button>
              <button
                type="button"
                className="thumb-context-btn"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(contextItem.url);
                    setCopiedUrl(contextItem.url);
                  } catch {
                    setCopiedUrl(null);
                  }
                }}
              >
                URLをコピー
              </button>
            </div>
            {copiedUrl === contextItem.url && <p className="thumb-context-copy-ok">URLをコピーしました</p>}
          </div>
        )}
      </div>
  );
}












