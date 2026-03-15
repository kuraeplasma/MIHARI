"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Clock, ArrowRight, Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { SiteDoc } from "@/types/domain";
import { StatusPill } from "@/components/status-pill";

interface SitesResponse {
  sites: SiteDoc[];
}

type RiskKey = "low" | "mid" | "high" | "pending";

const RISK_META: Record<RiskKey, { label: string; color: string; dot: string }> = {
  low: { label: "低リスク", color: "#1db954", dot: "#1db954" },
  mid: { label: "中リスク", color: "#f59e0b", dot: "#f59e0b" },
  high: { label: "高リスク", color: "#ef4444", dot: "#ef4444" },
  pending: { label: "解析待ち", color: "#9ca3af", dot: "#9ca3af" }
};

function getDomain(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function getRisk(site: SiteDoc) {
  const score = Number.isFinite(site.healthScore) ? site.healthScore : 0;

  if (site.status === "pending" || !site.lastCheckedAt) {
    return { key: "pending" as const, score, ...RISK_META.pending };
  }
  if (site.status === "down") {
    return { key: "high" as const, score, ...RISK_META.high };
  }
  if (site.status === "degraded") {
    return { key: "mid" as const, score, ...RISK_META.mid };
  }
  if (score >= 80) {
    return { key: "low" as const, score, ...RISK_META.low };
  }
  if (score >= 50) {
    return { key: "mid" as const, score, ...RISK_META.mid };
  }
  return { key: "high" as const, score, ...RISK_META.high };
}

function getAISummary(site: SiteDoc, riskKey: RiskKey) {
  if (riskKey === "pending") {
    return "初回解析を実行中です。結果が反映されるまでしばらくお待ちください。";
  }
  if (site.status === "down") {
    return "サイトへのアクセスが不可能です。ホスティングまたはDNSをすぐに確認してください。";
  }
  if (riskKey === "high") {
    return "高リスクの兆候を検知しました。変更点と公開状態を優先的に確認してください。";
  }
  if (site.status === "degraded" || riskKey === "mid") {
    return "一部の機能に問題が検知されています。フォームやAPIレスポンスを確認してください。";
  }
  return "重大なリスクは検知されていません。定期的な監視を継続中です。";
}

function RingGauge({ score, color, size = 64 }: { score: number; color: string; size?: number }) {
  const r = size * 0.4;
  const circ = 2 * Math.PI * r;
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 100);
    return () => clearTimeout(timer);
  }, [score]);

  const fill = circ * (animatedScore / 100);

  return (
    <div className="score-circle-container" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f0f0f0" strokeWidth={size * 0.12} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={size * 0.12}
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="score-circle-value">
        <span className="score-circle-number animate-count-up" style={{ fontSize: size * 0.38, color }}>
          {score}
        </span>
        <span className="score-circle-total" style={{ fontSize: size * 0.12 }}>
          / 100
        </span>
      </div>
    </div>
  );
}

export default function AIReportsPage() {
  const { apiFetch, token } = useAuth();
  const [sites, setSites] = useState<SiteDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      try {
        setLoading(true);
        const res = await apiFetch("/api/sites");
        if (!res.ok) throw new Error("サイトデータの取得に失敗しました");
        const payload = (await res.json()) as SitesResponse;
        setSites(payload.sites);
      } catch (e) {
        console.error("Failed to fetch sites for AI reports:", e);
        setError(e instanceof Error ? e.message : "サイトデータの取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [apiFetch, token]);

  const sitesWithRisk = useMemo(() => {
    return sites.map((site) => ({ site, risk: getRisk(site) }));
  }, [sites]);

  const counts = useMemo(() => {
    const next = { high: 0, mid: 0, low: 0, pending: 0, total: sitesWithRisk.length };
    for (const item of sitesWithRisk) {
      next[item.risk.key] += 1;
    }
    return next;
  }, [sitesWithRisk]);

  const analyzedTotal = counts.high + counts.mid + counts.low;

  const avgScore = useMemo(() => {
    const analyzed = sitesWithRisk.filter((item) => item.risk.key !== "pending");
    if (analyzed.length === 0) return 0;
    const totalScore = analyzed.reduce((sum, item) => sum + (item.site.healthScore ?? 0), 0);
    return Math.round(totalScore / analyzed.length);
  }, [sitesWithRisk]);

  const avgColor = analyzedTotal === 0 ? "#9ca3af" : avgScore >= 80 ? "#1db954" : avgScore >= 50 ? "#f59e0b" : "#ef4444";

  const ratio = (count: number) => {
    if (analyzedTotal === 0) return 0;
    return Math.round((count / analyzedTotal) * 100);
  };

  return (
    <>
      <div className="dashboard-main-padding">
        <div className="page-header">
          <div className="page-header-copy">
            <span className="page-eyebrow">AI Analysis</span>
            <h2 className="page-title">AI 解析レポート</h2>
            <p className="page-subtitle">高度な AI モデルによる各サイトのリスク評価と改善提案</p>
          </div>
        </div>

        {error && (
          <div className="data-panel" style={{ borderColor: "var(--danger)", background: "var(--danger-bg)" }}>
            <div style={{ padding: "1rem 1.5rem", color: "var(--danger)", fontSize: "0.875rem" }}>{error}</div>
          </div>
        )}

        <div className="data-panel" style={{ overflow: "hidden" }}>
          <div className="panel-header" style={{ borderBottom: "1px solid var(--border)" }}>
            <h3 className="panel-title">リスク概況</h3>
            <span style={{ fontSize: "0.75rem", color: "var(--text-4)" }}>
              {loading ? "—" : `${counts.total} サイト監視中`}
            </span>
          </div>

          <div style={{ padding: "1.75rem 2rem", display: "flex", gap: "3rem", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
              <RingGauge score={avgScore} color={avgColor} size={100} />
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  color: "var(--text-4)",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em"
                }}
              >
                平均スコア
              </span>
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div
                style={{
                  display: "flex",
                  height: "10px",
                  borderRadius: "var(--r-full)",
                  overflow: "hidden",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)"
                }}
              >
                {!loading && analyzedTotal > 0 ? (
                  <>
                    {counts.low > 0 && <div style={{ flex: counts.low, background: "#1db954", transition: "flex 0.8s var(--ease)" }} />}
                    {counts.mid > 0 && <div style={{ flex: counts.mid, background: "#f59e0b", transition: "flex 0.8s var(--ease)" }} />}
                    {counts.high > 0 && <div style={{ flex: counts.high, background: "#ef4444", transition: "flex 0.8s var(--ease)" }} />}
                  </>
                ) : (
                  <div style={{ flex: 1, background: "#d1d5db" }} />
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0" }}>
                {[
                  { label: "低リスク", count: counts.low, color: "#1db954", Icon: TrendingUp },
                  { label: "中リスク", count: counts.mid, color: "#f59e0b", Icon: Minus },
                  { label: "高リスク", count: counts.high, color: "#ef4444", Icon: TrendingDown }
                ].map((item, i) => (
                  <div
                    key={item.label}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.25rem",
                      padding: "0 1.25rem",
                      borderLeft: i > 0 ? "1px solid var(--border)" : "none"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <item.Icon size={13} style={{ color: item.color }} />
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 700,
                          color: "var(--text-4)",
                          textTransform: "uppercase",
                          letterSpacing: "0.07em"
                        }}
                      >
                        {item.label}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.375rem" }}>
                      <span
                        style={{
                          fontSize: "1.5rem",
                          fontWeight: 800,
                          letterSpacing: "-0.04em",
                          color: "var(--text)",
                          lineHeight: 1
                        }}
                      >
                        {loading ? "—" : item.count}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-4)" }}>
                        {!loading && analyzedTotal > 0 ? `/ ${ratio(item.count)}%` : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {!loading && counts.pending > 0 && (
                <div style={{ fontSize: "0.75rem", color: "var(--text-4)", paddingLeft: "1.25rem" }}>
                  解析待ち: {counts.pending} サイト
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="data-panel">
          <div className="panel-header" style={{ borderBottom: "1px solid var(--border)" }}>
            <h3 className="panel-title">サイト別レポート</h3>
          </div>

          {loading && (
            <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton" style={{ height: "90px", borderRadius: "var(--r-md)" }} />
              ))}
            </div>
          )}

          {!loading && sitesWithRisk.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">
                <Sparkles size={20} style={{ color: "var(--emerald)" }} />
              </div>
              <p className="empty-title">監視中のサイトがありません</p>
              <p className="empty-body">サイトを追加すると、AI解析レポートが自動生成されます。</p>
              <Link href="/dashboard/add" className="btn btn-primary btn-sm" style={{ marginTop: "0.5rem" }}>
                最初のサイトを追加
              </Link>
            </div>
          )}

          {!loading && sitesWithRisk.length > 0 && (
            <div className="card-list">
              {sitesWithRisk.map(({ site, risk }) => {
                const summary = getAISummary(site, risk.key);

                return (
                  <div key={site.siteId} className="list-row" style={{ gap: "1.25rem", alignItems: "flex-start", padding: "1.125rem 1.5rem" }}>
                    <div style={{ flexShrink: 0 }}>
                      <RingGauge score={risk.key === "pending" ? 0 : risk.score} color={risk.color} size={72} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.25rem" }}>
                        <span className="row-primary">{getDomain(site.url)}</span>
                        <span
                          style={{
                            fontSize: "0.6875rem",
                            fontWeight: 700,
                            color: risk.color,
                            letterSpacing: "0.03em",
                            textTransform: "uppercase"
                          }}
                        >
                          {risk.label}
                        </span>
                        <StatusPill status={site.status} />
                      </div>
                      <p className="row-secondary" style={{ lineHeight: 1.5, maxWidth: "520px" }}>
                        {summary}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginTop: "0.5rem", fontSize: "0.725rem", color: "var(--text-4)" }}>
                        <Clock size={11} />
                        最終解析: {site.lastCheckedAt ? new Date(site.lastCheckedAt).toLocaleString() : "未実行"}
                      </div>
                    </div>

                    <Link
                      href={`/dashboard/sites/${site.siteId}`}
                      className="btn btn-ghost btn-xs"
                      style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "0.25rem", marginTop: "4px" }}
                    >
                      詳細 <ArrowRight size={12} />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
