"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatusPill } from "@/components/status-pill";
import { useAuth } from "@/components/auth-provider";
import { SiteDoc } from "@/types/domain";

type FilterMode = "all" | "errors";

interface SitesResponse {
  sites: SiteDoc[];
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export default function SitesPage() {
  const { apiFetch, token } = useAuth();
  const [sites, setSites] = useState<SiteDoc[]>([]);
  const [filter, setFilter] = useState<FilterMode>("all");
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
        const res = await apiFetch("/api/sites");
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error ?? "Failed to load sites");
        }
        const payload = (await res.json()) as SitesResponse;
        setSites(payload.sites);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [apiFetch, token]);

  const filteredSites = useMemo(() => {
    if (filter === "all") {
      return sites;
    }
    return sites.filter((site) => site.status === "down" || site.status === "degraded");
  }, [filter, sites]);

  const deleteSite = async (siteId: string) => {
    const confirmed = window.confirm("Delete this website and all monitoring data?");
    if (!confirmed) {
      return;
    }

    try {
      const res = await apiFetch(`/api/sites/${siteId}`, {
        method: "DELETE"
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to delete site");
      }
      setSites((prev) => prev.filter((site) => site.siteId !== siteId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete site");
    }
  };

  return (
    <DashboardShell>
      <section className="panel">
        <div className="section-head">
          <div className="section-head-copy">
            <h3>監視サイト一覧</h3>
            <p className="tiny-copy">ドメイン、ステータス、Healthスコア、最終チェックを一覧で管理できます。</p>
          </div>
          <div className="filter-row">
            <button
              className={filter === "all" ? "filter-chip active" : "filter-chip"}
              onClick={() => setFilter("all")}
            >
              すべて
            </button>
            <button
              className={filter === "errors" ? "filter-chip active" : "filter-chip"}
              onClick={() => setFilter("errors")}
            >
              エラーのみ
            </button>
          </div>
        </div>
      </section>

      {loading && <p>Loading sites...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && (
        <section className="panel">
          <table className="site-table">
            <thead>
              <tr>
                <th>ドメイン</th>
                <th>ステータス</th>
                <th>Healthスコア</th>
                <th>最終チェック</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredSites.map((site) => (
                <tr key={site.siteId}>
                  <td>
                    <div className="table-domain">
                      <span className="mono-link">{getDomain(site.url)}</span>
                      <span className="table-meta">{site.url}</span>
                    </div>
                  </td>
                  <td>
                    <div className="table-domain">
                      <StatusPill status={site.status} />
                      <span className="table-status-text">
                        {site.status === "healthy"
                          ? "監視正常"
                          : site.status === "down"
                            ? "即時対応が必要"
                            : "注意が必要"}
                      </span>
                    </div>
                  </td>
                  <td>{site.healthScore}</td>
                  <td>{site.lastCheckedAt ? new Date(site.lastCheckedAt).toLocaleString() : "未実行"}</td>
                  <td>
                    <div className="table-actions">
                      <Link href={`/dashboard/sites/${site.siteId}`} className="btn btn-muted btn-xs">
                        詳細
                      </Link>
                      <button className="btn btn-danger btn-xs" onClick={() => void deleteSite(site.siteId)}>
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSites.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">選択した条件に一致するサイトはありません。</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </DashboardShell>
  );
}
