"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatusPill } from "@/components/status-pill";
import { useAuth } from "@/components/auth-provider";
import { CheckResultDoc, SiteDoc } from "@/types/domain";

interface SiteDetailResponse {
  site: SiteDoc;
  results: CheckResultDoc[];
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export default function SiteDetailsPage() {
  const params = useParams<{ siteId: string }>();
  const { apiFetch, token } = useAuth();
  const [payload, setPayload] = useState<SiteDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !params?.siteId) {
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/api/sites/${params.siteId}`);
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error ?? "Failed to load site details");
        }
        const json = (await res.json()) as SiteDetailResponse;
        setPayload(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [apiFetch, params?.siteId, token]);

  const latestResult = payload?.results[0] ?? null;
  const latestAi = latestResult?.aiAnalysis ?? null;

  const analysis = useMemo(() => {
    if (!latestResult) {
      return null;
    }

    const issues: string[] = [];
    if (!latestResult.uptime.ok) {
      issues.push(`HTTPチェック失敗 (HTTP ${latestResult.uptime.statusCode ?? "unknown"})`);
    }
    if (!latestResult.links.ok) {
      issues.push(`リンク異常 ${latestResult.links.brokenCount} 件`);
    }
    if (!latestResult.form.ok && latestResult.form.status !== "not_checked") {
      issues.push(latestResult.form.reason ?? `フォームエラー (${latestResult.form.status})`);
    }
    if (!latestResult.rendering.ok) {
      issues.push(latestResult.rendering.consoleErrors[0] ?? "レンダリングエラー");
    }

    return issues.length > 0 ? issues.join(" / ") : null;
  }, [latestResult]);

  return (
    <DashboardShell>
      {loading && <p>Loading details...</p>}
      {error && <p className="error-text">{error}</p>}

      {payload && (
        <>
          <section className="panel hero-panel">
            <div className="section-head">
              <div className="section-head-copy">
                <p className="eyebrow">Site Detail</p>
                <h3>{getDomain(payload.site.url)}</h3>
                <p className="tiny-copy">{payload.site.url}</p>
              </div>
              <StatusPill status={payload.site.status} />
            </div>
          </section>

          <section className="detail-grid">
            <article className="detail-card">
              <p className="tiny-copy">Healthスコア</p>
              <strong className="detail-value">{payload.site.healthScore}</strong>
            </article>
            <article className="detail-card">
              <p className="tiny-copy">最終チェック</p>
              <strong>{payload.site.lastCheckedAt ? new Date(payload.site.lastCheckedAt).toLocaleString() : "-"}</strong>
            </article>
            <article className="detail-card">
              <p className="tiny-copy">次回チェック予定</p>
              <strong>{new Date(payload.site.nextCheckAt).toLocaleString()}</strong>
            </article>
          </section>

          <section className="panel">
            <div className="section-head-copy">
              <h3>監視結果</h3>
              <p className="tiny-copy">HTTP / リンク / フォームの最新結果を表示します。</p>
            </div>
            {!latestResult ? (
              <div className="empty-state">まだ監視結果がありません。</div>
            ) : (
              <div className="status-detail-grid">
                <article className="detail-card">
                  <p className="tiny-copy">HTTP</p>
                  <strong>{latestResult.uptime.ok ? "正常" : `異常 ${latestResult.uptime.statusCode ?? ""}`}</strong>
                  <span className="tiny-copy">Latency {latestResult.uptime.latencyMs ?? "-"} ms</span>
                </article>
                <article className="detail-card">
                  <p className="tiny-copy">リンク</p>
                  <strong>{latestResult.links.ok ? "正常" : `${latestResult.links.brokenCount} 件の異常`}</strong>
                  <span className="tiny-copy">チェック数 {latestResult.links.checkedCount}</span>
                </article>
                <article className="detail-card">
                  <p className="tiny-copy">フォーム</p>
                  <strong>{latestResult.form.ok ? "正常" : latestResult.form.status}</strong>
                  <span className="tiny-copy">{latestResult.form.reason ?? "追加メッセージなし"}</span>
                </article>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="section-head-copy">
              <h3>チェック履歴</h3>
              <p className="tiny-copy">timestamp と各項目の結果を時系列で確認できます。</p>
            </div>
            {payload.results.length === 0 ? (
              <div className="empty-state">履歴データはまだありません。</div>
            ) : (
              <ul className="history-list">
                {payload.results.map((result) => (
                  <li key={result.resultId} className="history-item">
                    <strong>{new Date(result.createdAt).toLocaleString()}</strong>
                    <div className="history-item-copy">
                      <span>
                        HTTP {result.uptime.ok ? "ok" : "error"} / リンク{" "}
                        {result.links.ok ? "ok" : `${result.links.brokenCount} broken`} / フォーム {result.form.status}
                      </span>
                      <span className="tiny-copy">
                        Rendering {result.rendering.ok ? "ok" : "error"} / overall {result.overallStatus}
                      </span>
                    </div>
                    <StatusPill status={result.overallStatus} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel analysis-card">
            <div className="section-head-copy">
              <h3>原因 / AI分析 / 推奨対応</h3>
              <p className="tiny-copy">最新チェックで異常がある場合に、原因と推奨アクションを整理します。</p>
            </div>
            {analysis ? (
              <>
                <div className="analysis-row">
                  <p className="tiny-copy">原因</p>
                  <strong>{analysis}</strong>
                </div>
                <div className="analysis-row">
                  <p className="tiny-copy">AI分析</p>
                  <strong>{latestAi?.cause ?? "AI分析はありません。"}</strong>
                </div>
                <div className="analysis-row">
                  <p className="tiny-copy">推奨対応</p>
                  <strong>{latestAi?.suggestedFix ?? "推奨対応はありません。"}</strong>
                </div>
              </>
            ) : (
              <div className="empty-state">最新チェックではアクティブなエラーはありません。</div>
            )}
          </section>
        </>
      )}
    </DashboardShell>
  );
}
