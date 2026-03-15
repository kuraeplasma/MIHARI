"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/status-pill";
import { useAuth } from "@/components/auth-provider";
import { CheckResultDoc, SiteDoc } from "@/types/domain";
import {
  ArrowLeft,
  Activity,
  ShieldCheck,
  Link2,
  Layout,
  Zap,
  Globe,
  Database,
  History as HistoryIcon,
  RefreshCcw
} from "lucide-react";

interface SiteDetailResponse {
  site: SiteDoc;
  results: CheckResultDoc[];
}

type MetricTone = "ok" | "danger" | "pending";
type NoticeTone = "info" | "success" | "error";

function getDomain(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function getExpiryLabel(days: number | null | undefined) {
  if (days == null || Number.isNaN(days)) return { text: "未取得", color: "var(--text-4)" };
  if (days < 0) return { text: "期限切れ", color: "var(--danger)" };
  if (days <= 7) return { text: "重大", color: "var(--danger)" };
  if (days <= 30) return { text: "警告", color: "var(--warn)" };
  return { text: "正常", color: "var(--ok)" };
}

function formatExpiryDate(dateIso: string | null | undefined) {
  if (!dateIso) return "未取得";
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) return "未取得";
  return parsed.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
}

function metricColors(tone: MetricTone) {
  if (tone === "ok") {
    return { border: "4px solid var(--emerald)", icon: "var(--emerald)" };
  }
  if (tone === "danger") {
    return { border: "4px solid var(--danger)", icon: "var(--danger)" };
  }
  return { border: "4px solid var(--border)", icon: "var(--text-4)" };
}

function formStatusLabel(status: CheckResultDoc["form"]["status"]) {
  switch (status) {
    case "pass":
      return "正常";
    case "fail":
      return "異常";
    case "not_checked":
      return "未実施";
    case "captcha_detected":
      return "CAPTCHA検出";
    case "not_found":
      return "フォーム未検出";
    default:
      return "不明";
  }
}

export default function SiteDetailsPage() {
  const params = useParams<{ siteId: string }>();
  const { apiFetch, token } = useAuth();
  const [payload, setPayload] = useState<SiteDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningManualCheck, setRunningManualCheck] = useState(false);
  const [runNotice, setRunNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);

  const payloadRef = useRef<SiteDetailResponse | null>(null);

  useEffect(() => {
    payloadRef.current = payload;
  }, [payload]);

  const loadDetails = useCallback(async (options?: { silent?: boolean }) => {
    if (!token || !params?.siteId) return;

    const silent = Boolean(options?.silent && payloadRef.current);
    if (!silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await apiFetch(`/api/sites/${params.siteId}`);
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "サイト詳細の取得に失敗しました");
      }
      const json = (await res.json()) as SiteDetailResponse;
      setPayload(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "不明なエラーが発生しました");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [apiFetch, params?.siteId, token]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const runManualCheck = useCallback(async () => {
    if (!params?.siteId || runningManualCheck) {
      return;
    }

    setRunningManualCheck(true);
    setRunNotice({ tone: "info", text: "解析をキューへ登録しています..." });

    try {
      const res = await apiFetch(`/api/sites/${params.siteId}/run`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? "解析の開始に失敗しました");
      }

      setRunNotice({ tone: "success", text: "解析を開始しました（通常30〜90秒）" });
      void loadDetails({ silent: true });
      setTimeout(() => {
        void loadDetails({ silent: true });
      }, 4000);
    } catch (e) {
      setRunNotice({ tone: "error", text: e instanceof Error ? e.message : "解析の開始に失敗しました" });
    } finally {
      setRunningManualCheck(false);
    }
  }, [apiFetch, loadDetails, params?.siteId, runningManualCheck]);

  const latestResult = payload?.results[0] ?? null;
  const latestAi = latestResult?.aiAnalysis ?? null;
  const isAnalysisPending = Boolean(payload && (payload.site.status === "pending" || !payload.site.lastCheckedAt || !latestResult));
  const compactPendingView = Boolean(isAnalysisPending && (payload?.results.length ?? 0) === 0);

  const spacing = compactPendingView ? "0.7rem" : "1.35rem";
  const panelPadding = compactPendingView ? "0.8rem" : "1.15rem";

  const checkCards = useMemo(() => {
    if (isAnalysisPending || !latestResult) {
      return [
        { label: "HTTP接続", icon: Zap, tone: "pending" as const, detail: "解析待ち" },
        { label: "リンク整合性", icon: Link2, tone: "pending" as const, detail: "解析待ち" },
        { label: "フォーム機能", icon: Database, tone: "pending" as const, detail: "解析待ち" },
        { label: "画面レンダリング", icon: Layout, tone: "pending" as const, detail: "解析待ち" }
      ];
    }

    const formTone: MetricTone =
      latestResult.form.status === "not_checked"
        ? "pending"
        : latestResult.form.ok
          ? "ok"
          : "danger";

    return [
      {
        label: "HTTP接続",
        icon: Zap,
        tone: latestResult.uptime.ok ? ("ok" as const) : ("danger" as const),
        detail: latestResult.uptime.statusCode == null ? "ステータス: 取得失敗" : `ステータス: ${latestResult.uptime.statusCode}`
      },
      {
        label: "リンク整合性",
        icon: Link2,
        tone: latestResult.links.ok ? ("ok" as const) : ("danger" as const),
        detail: latestResult.links.ok ? "異常なし" : `切れリンク ${latestResult.links.brokenCount}件`
      },
      {
        label: "フォーム機能",
        icon: Database,
        tone: formTone,
        detail: formStatusLabel(latestResult.form.status)
      },
      {
        label: "画面レンダリング",
        icon: Layout,
        tone: latestResult.rendering.ok ? ("ok" as const) : ("danger" as const),
        detail: latestResult.rendering.ok ? "正常" : "警告あり"
      }
    ];
  }, [isAnalysisPending, latestResult]);

  const quickSummary = useMemo(() => {
    if (!payload) return null;
    if (isAnalysisPending) {
      return "初回解析を実行中です。結果が反映されるまでしばらくお待ちください。";
    }
    if (!latestResult) return null;

    const issues: string[] = [];
    if (!latestResult.uptime.ok) issues.push("HTTP接続の異常");
    if (!latestResult.links.ok) issues.push(`切れリンク ${latestResult.links.brokenCount}件`);
    if (!latestResult.form.ok && latestResult.form.status !== "not_checked") issues.push("フォーム異常");
    if (!latestResult.rendering.ok) issues.push("レンダリング異常");
    return issues.length > 0 ? issues.join(" / ") : "重大なリスクは検知されていません。定期的な監視を継続中です。";
  }, [isAnalysisPending, latestResult, payload]);

  return (
    <>
      <div className={`dashboard-main-padding site-detail-page${compactPendingView ? " compact" : ""}`}>
        <Link
          href="/dashboard/sites"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.84rem",
            fontWeight: 700,
            color: "var(--text-2)",
            marginBottom: compactPendingView ? "0.55rem" : "0.85rem"
          }}
          className="hover-emerald"
        >
          <ArrowLeft size={16} />
          監視サイト一覧へ戻る
        </Link>

        {loading ? (
          <div className="empty-state" style={{ padding: compactPendingView ? "2rem" : "4rem" }}>
            <div style={{ width: "32px", height: "32px", border: "2px solid var(--border)", borderTopColor: "var(--emerald)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            <p style={{ marginTop: "1rem" }}>読み込み中...</p>
          </div>
        ) : error ? (
          <div style={{ padding: "2rem", color: "var(--danger)", textAlign: "center", fontSize: "0.95rem", fontWeight: 700 }}>
            {error}
          </div>
        ) : payload && (
          <div className="site-detail-stack" style={{ gap: spacing }}>
            <div
              className="data-panel"
              style={{
                background: "linear-gradient(135deg, var(--navy) 0%, var(--sb-surface) 100%)",
                border: "1px solid var(--navy-3)",
                padding: compactPendingView ? "0.9rem 1.2rem" : "1.4rem 1.8rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                position: "relative",
                overflow: "hidden"
              }}
            >
              <div style={{ zIndex: 1 }}>
                <span className="page-eyebrow site-eyebrow">サイト監視インテリジェンス</span>
                <h1 className="page-title" style={{ color: "#ffffff", marginBottom: compactPendingView ? "0.28rem" : "0.45rem", fontSize: compactPendingView ? "1.9rem" : undefined }}>{getDomain(payload.site.url)}</h1>
                <div className="site-url-row">
                  <Globe size={14} />
                  {payload.site.url}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.55rem", zIndex: 1 }}>
                <StatusPill status={payload.site.status} />
                <div className="site-score-row">
                  スコア: <span style={{ fontSize: compactPendingView ? "1.1rem" : "1.25rem", fontFamily: "JetBrains Mono" }}>{isAnalysisPending ? "-" : payload.site.healthScore}</span>
                </div>
                <button className="site-run-btn" onClick={() => void runManualCheck()} disabled={runningManualCheck}>
                  <RefreshCcw size={14} />
                  {runningManualCheck ? "解析キュー登録中..." : "今すぐ解析"}
                </button>
                {runNotice && <p className={`site-run-notice ${runNotice.tone}`}>{runNotice.text}</p>}
              </div>
              <div style={{ position: "absolute", top: "-20%", right: "-5%", opacity: 0.07, pointerEvents: "none" }}>
                <ShieldCheck size={compactPendingView ? 210 : 250} color="var(--emerald)" />
              </div>
            </div>

            <div className="stat-row-grid site-kpi-grid">
              <div className="data-panel" style={{ padding: panelPadding }}>
                <p className="kpi-label">応答時間</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem", marginTop: "0.32rem" }}>
                  <span className="site-value-strong" style={{ fontSize: compactPendingView ? "1.3rem" : "1.6rem" }}>{latestResult?.uptime.latencyMs ?? "-"}</span>
                  <span className="site-muted-text" style={{ fontSize: "0.78rem", fontWeight: 700 }}>ms</span>
                </div>
              </div>
              <div className="data-panel" style={{ padding: panelPadding }}>
                <p className="kpi-label">最終チェック</p>
                <div className="site-value-strong" style={{ fontSize: compactPendingView ? "0.9rem" : "0.98rem", marginTop: "0.32rem" }}>
                  {payload.site.lastCheckedAt ? new Date(payload.site.lastCheckedAt).toLocaleString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "-"}
                </div>
              </div>
              <div className="data-panel" style={{ padding: panelPadding }}>
                <p className="kpi-label">次回チェック</p>
                <div className="site-value-strong" style={{ fontSize: compactPendingView ? "0.9rem" : "0.98rem", marginTop: "0.32rem" }}>
                  {new Date(payload.site.nextCheckAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>

            <div className="data-panel">
              <div className="panel-header" style={{ padding: compactPendingView ? "0.72rem 0.95rem" : "1rem 1.2rem" }}>
                <h3 className="panel-title">証明書・ドメイン情報</h3>
              </div>
              <div style={{ padding: compactPendingView ? "0.72rem 0.95rem" : "1rem 1.2rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: compactPendingView ? "0.6rem" : "0.9rem" }}>
                <div className="site-mini-card">
                  <p className="site-mini-title">SSL証明書</p>
                  <p className="site-readable-text" style={{ fontSize: compactPendingView ? "0.86rem" : "0.92rem" }}>
                    有効期限：{formatExpiryDate(payload.site.ssl_expiry_date)}
                    {payload.site.ssl_expiry_days == null ? "" : payload.site.ssl_expiry_days < 0 ? "（期限切れ）" : `（残り${payload.site.ssl_expiry_days}日）`}
                  </p>
                  <p style={{ marginTop: "0.4rem", fontWeight: 700, color: getExpiryLabel(payload.site.ssl_expiry_days).color }}>
                    ●{getExpiryLabel(payload.site.ssl_expiry_days).text}
                  </p>
                </div>
                <div className="site-mini-card">
                  <p className="site-mini-title">ドメイン</p>
                  <p className="site-readable-text" style={{ fontSize: compactPendingView ? "0.86rem" : "0.92rem" }}>
                    有効期限：{formatExpiryDate(payload.site.domain_expiry_date)}
                    {payload.site.domain_expiry_days == null ? "" : payload.site.domain_expiry_days < 0 ? "（期限切れ）" : `（残り${payload.site.domain_expiry_days}日）`}
                  </p>
                  <p style={{ marginTop: "0.4rem", fontWeight: 700, color: getExpiryLabel(payload.site.domain_expiry_days).color }}>
                    ●{getExpiryLabel(payload.site.domain_expiry_days).text}
                  </p>
                </div>
              </div>
            </div>

            <div className="site-check-grid" style={{ gap: compactPendingView ? "0.62rem" : "0.9rem" }}>
              {checkCards.map((item, idx) => {
                const colors = metricColors(item.tone);
                return (
                  <div key={idx} className="data-panel" style={{ padding: panelPadding, borderLeft: colors.border }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.62rem", marginBottom: "0.32rem" }}>
                      <item.icon size={17} style={{ color: colors.icon }} />
                      <span className="metric-label">{item.label}</span>
                    </div>
                    <div className="metric-detail">{item.detail}</div>
                  </div>
                );
              })}
            </div>

            <div className="data-panel" style={{ padding: 0, background: "var(--emerald-glass)", border: "1px solid rgba(16, 185, 129, 0.24)" }}>
              <div className="panel-header" style={{ background: "transparent", borderBottom: "1px solid rgba(16, 185, 129, 0.12)", padding: compactPendingView ? "0.68rem 0.95rem" : "0.95rem 1.2rem" }}>
                <h3 className="panel-title" style={{ color: "var(--emerald-dark)", display: "flex", alignItems: "center", gap: "0.45rem" }}>
                  <Activity size={18} />
                  AI 診断 & 異常分析
                </h3>
              </div>

              {compactPendingView ? (
                <div style={{ padding: "0.8rem 0.95rem" }}>
                  <p className="site-readable-text" style={{ fontSize: "0.89rem" }}>
                    {latestAi?.cause ?? "初回解析を実行中です。解析完了後に原因分析と推奨アクションを表示します。"}
                  </p>
                </div>
              ) : (
                <div style={{ padding: "1.2rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.6rem" }}>
                  <div>
                    <p className="site-section-label">原因分析</p>
                    <p className="site-readable-text">
                      {latestAi?.cause ?? (isAnalysisPending ? "初回解析を実行中です。結果が反映されるまでしばらくお待ちください。" : quickSummary ?? "AI分析結果はありません。")}
                    </p>
                  </div>
                  <div>
                    <p className="site-section-label">推奨アクション</p>
                    <p className="site-readable-text">
                      {latestAi?.suggestedFix ?? (isAnalysisPending ? "解析完了後に推奨アクションを表示します。" : "優先度の高い問題から順に確認してください。")}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="data-panel">
              <div className="panel-header" style={{ padding: compactPendingView ? "0.68rem 0.95rem" : "0.95rem 1.2rem" }}>
                <h3 className="panel-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <HistoryIcon size={18} />
                  監視ログ・履歴
                </h3>
              </div>
              <div className="card-list">
                {payload.results.length === 0 ? (
                  <div className="empty-state" style={{ padding: compactPendingView ? "0.9rem 1rem" : "2rem" }}>
                    <p className="site-readable-text" style={{ fontSize: compactPendingView ? "0.89rem" : "0.95rem" }}>
                      {isAnalysisPending ? "初回解析が完了すると、ここに監視ログが表示されます。" : "履歴データはまだありません。"}
                    </p>
                  </div>
                ) : (
                  payload.results.map((result) => (
                    <div key={result.resultId} className="list-row" style={{ display: "grid", gridTemplateColumns: "200px 1fr 120px", gap: "1.25rem" }}>
                      <div className="site-muted-text" style={{ fontSize: "0.83rem", fontWeight: 700, fontFamily: "JetBrains Mono" }}>
                        {new Date(result.createdAt).toLocaleString()}
                      </div>
                      <div style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.78rem", color: result.uptime.ok ? "var(--text-2)" : "var(--danger)", fontWeight: 700 }}>
                          HTTP: {result.uptime.ok ? "正常" : "異常"}
                        </span>
                        <span style={{ fontSize: "0.78rem", color: result.links.ok ? "var(--text-2)" : "var(--danger)", fontWeight: 700 }}>
                          リンク: {result.links.ok ? "正常" : `異常 ${result.links.brokenCount}件`}
                        </span>
                        <span style={{ fontSize: "0.78rem", color: result.form.ok ? "var(--text-2)" : "var(--danger)", fontWeight: 700 }}>
                          フォーム: {result.form.status === "not_checked" ? "未実施" : result.form.ok ? "正常" : "異常"}
                        </span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <StatusPill status={result.overallStatus} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .site-detail-stack {
          display: flex;
          flex-direction: column;
        }

        .site-check-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .site-detail-page {
          color: var(--text);
        }

        .site-detail-page :global(.data-panel) {
          box-shadow: 0 1px 0 rgba(15, 23, 42, 0.02);
        }

        .site-detail-page :global(.kpi-label),
        .metric-label,
        .site-mini-title,
        .site-section-label {
          color: var(--text-2);
          font-size: 0.73rem;
          font-weight: 800;
          letter-spacing: 0.04em;
        }

        .site-value-strong,
        .metric-detail,
        .site-readable-text {
          color: var(--text);
          font-weight: 600;
          line-height: 1.55;
        }

        .metric-detail {
          font-size: 0.94rem;
        }

        .site-mini-card {
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 0.82rem;
        }

        .site-url-row {
          display: flex;
          align-items: center;
          gap: 0.62rem;
          font-size: 0.84rem;
          color: rgba(255, 255, 255, 0.86);
          font-weight: 500;
        }

        .site-eyebrow {
          color: rgba(110, 231, 183, 0.95);
        }

        .site-score-row {
          font-size: 0.8rem;
          font-weight: 700;
          color: rgba(110, 231, 183, 0.95);
          letter-spacing: 0.06em;
        }

        .site-run-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          border: 1px solid rgba(110, 231, 183, 0.5);
          background: rgba(16, 185, 129, 0.15);
          color: #d1fae5;
          font-size: 0.78rem;
          font-weight: 700;
          border-radius: 999px;
          padding: 0.35rem 0.75rem;
          cursor: pointer;
        }

        .site-run-btn:disabled {
          opacity: 0.65;
          cursor: wait;
        }

        .site-run-notice {
          margin: 0;
          text-align: right;
          font-size: 0.75rem;
          line-height: 1.3;
          white-space: nowrap;
        }

        .site-run-notice.info {
          color: #c7d2fe;
        }

        .site-run-notice.success {
          color: #bbf7d0;
        }

        .site-run-notice.error {
          color: #fecaca;
        }

        .site-muted-text {
          color: var(--text-2);
        }

        .hover-emerald:hover {
          color: var(--emerald) !important;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1100px) {
          .site-check-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 860px) {
          .site-kpi-grid {
            grid-template-columns: 1fr;
          }

          .site-check-grid {
            grid-template-columns: 1fr;
          }

          .site-detail-page :global(.page-title) {
            font-size: 1.6rem !important;
          }

          .site-run-notice {
            white-space: normal;
            text-align: left;
          }
        }
      `}</style>
    </>
  );
}
