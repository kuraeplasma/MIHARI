"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatusPill } from "@/components/status-pill";
import { useAuth } from "@/components/auth-provider";
import { SiteDoc } from "@/types/domain";

interface ClientDetailResponse {
  client: {
    clientId: string;
    name: string;
  };
  sites: SiteDoc[];
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export default function CustomerDetailsPage() {
  const params = useParams<{ clientId: string }>();
  const { apiFetch, token } = useAuth();
  const [payload, setPayload] = useState<ClientDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !params?.clientId) {
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiFetch(`/api/clients/${params.clientId}`);
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error ?? "Failed to load client details");
        }
        setPayload((await res.json()) as ClientDetailResponse);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [apiFetch, params?.clientId, token]);

  const stats = useMemo(() => {
    const sites = payload?.sites ?? [];
    return {
      total: sites.length,
      errors: sites.filter((site) => site.status === "down").length,
      warnings: sites.filter((site) => site.status === "degraded" || site.status === "pending").length
    };
  }, [payload?.sites]);

  return (
    <DashboardShell>
      {loading && <p>Loading...</p>}
      {error && <p className="error-text">{error}</p>}

      {payload && (
        <>
          <section className="panel hero-panel">
            <div className="section-head">
              <div className="section-head-copy">
                <p className="eyebrow">Client Detail</p>
                <h3>{payload.client.name}</h3>
                <p className="tiny-copy">この顧客に紐づく監視サイトと現在の状態を確認できます。</p>
              </div>
              <Link href="/dashboard/customers" className="btn btn-muted">
                顧客一覧へ戻る
              </Link>
            </div>
          </section>

          <section className="metrics-grid">
            <article className="metric-card">
              <p className="tiny-copy">管理サイト数</p>
              <strong className="metric-value">{stats.total}</strong>
            </article>
            <article className="metric-card">
              <p className="tiny-copy">エラー数</p>
              <strong className="metric-value">{stats.errors}</strong>
            </article>
            <article className="metric-card">
              <p className="tiny-copy">警告数</p>
              <strong className="metric-value">{stats.warnings}</strong>
            </article>
          </section>

          <section className="panel">
            <div className="section-head-copy">
              <h3>顧客サイト一覧</h3>
              <p className="tiny-copy">顧客配下サイトを上から順に確認できます。</p>
            </div>

            <table className="site-table">
              <thead>
                <tr>
                  <th>ドメイン</th>
                  <th>ステータス</th>
                  <th>Healthスコア</th>
                  <th>最終チェック</th>
                </tr>
              </thead>
              <tbody>
                {payload.sites.map((site) => (
                  <tr key={site.siteId}>
                    <td>
                      <div className="table-domain">
                        <Link href={`/dashboard/sites/${site.siteId}`} className="mono-link">
                          {getDomain(site.url)}
                        </Link>
                        <span className="table-meta">{site.url}</span>
                      </div>
                    </td>
                    <td>
                      <StatusPill status={site.status} />
                    </td>
                    <td>{site.healthScore}</td>
                    <td>{site.lastCheckedAt ? new Date(site.lastCheckedAt).toLocaleString() : "-"}</td>
                  </tr>
                ))}
                {payload.sites.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <div className="empty-state">この顧客に紐づくサイトはありません。</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </DashboardShell>
  );
}
