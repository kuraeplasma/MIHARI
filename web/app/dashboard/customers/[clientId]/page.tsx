"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { StatusPill } from "@/components/status-pill";
import { useAuth } from "@/components/auth-provider";
import { SiteDoc } from "@/types/domain";
import { 
  ArrowLeft, 
  Globe, 
  AlertCircle, 
  Activity, 
  Clock
} from "lucide-react";

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
    if (!token || !params?.clientId) return;

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
    <>
      <div className="dashboard-main-padding">
        {/* Back Navigation */}
        <Link 
          href="/dashboard/customers" 
          style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: "0.5rem", 
            fontSize: "0.8125rem", 
            fontWeight: 700, 
            color: "var(--text-3)",
            marginBottom: "1rem",
            transition: "color 0.2s"
          }}
          className="hover-emerald"
        >
          <ArrowLeft size={16} />
          顧客一覧へ戻る
        </Link>

        {/* Hero Section */}
        {payload && (
          <div className="page-header" style={{ marginBottom: "2rem" }}>
            <div>
              <span className="page-eyebrow">Client Dashboard</span>
              <h1 className="page-title">{payload.client.name}</h1>
              <p className="page-subtitle">この顧客に紐づく {payload.sites.length} サイトの監視ステータスを管理しています。</p>
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
               {/* Context Info or Actions could go here */}
            </div>
          </div>
        )}

        {loading ? (
           <div className="empty-state" style={{ padding: "4rem" }}>
              <div style={{ width: "32px", height: "32px", border: "2px solid var(--border)", borderTopColor: "var(--emerald)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              <p style={{ marginTop: "1rem" }}>読み込み中...</p>
            </div>
        ) : error ? (
          <div style={{ padding: "2rem", color: "var(--danger)", textAlign: "center", fontSize: "0.9375rem", fontWeight: 600 }}>
            {error}
          </div>
        ) : payload && (
          <>
            {/* KPI Cards */}
            <div className="kpi-grid">
               <div className="kpi-card">
                <div className="kpi-top">
                  <span className="kpi-label">管理サイト</span>
                  <div className="kpi-icon-wrap" style={{ color: "var(--info)" }}><Globe size={18} /></div>
                </div>
                <div className="kpi-value">{stats.total}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-top">
                  <span className="kpi-label">重大エラー</span>
                  <div className="kpi-icon-wrap" style={{ color: "var(--danger)" }}><AlertCircle size={18} /></div>
                </div>
                <div className="kpi-value">{stats.errors}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-top">
                  <span className="kpi-label">警告・確認待ち</span>
                  <div className="kpi-icon-wrap" style={{ color: "var(--warn)" }}><Activity size={18} /></div>
                </div>
                <div className="kpi-value">{stats.warnings}</div>
              </div>
            </div>

            {/* Sites List */}
            <div className="data-panel" style={{ marginTop: "1.5rem" }}>
              <div className="panel-header">
                <h3 className="panel-title">顧客配下の監視サイト</h3>
              </div>

              <div className="card-list">
                <div style={{ 
                  padding: "0.75rem 1.5rem", 
                  borderBottom: "1px solid var(--border)", 
                  display: "grid", 
                  gridTemplateColumns: "1.5fr 120px 1fr 1fr", 
                  gap: "1rem", 
                  fontSize: "0.6875rem", 
                  fontWeight: 800, 
                  color: "var(--text-4)", 
                  textTransform: "uppercase", 
                  letterSpacing: "0.08em" 
                }}>
                  <span>監視対象 / ドメイン</span>
                  <span>ステータス</span>
                  <span>Health</span>
                  <span>最終チェック</span>
                </div>

                {payload.sites.length === 0 ? (
                  <div className="empty-state" style={{ padding: "4rem" }}>
                    <Globe size={40} style={{ opacity: 0.1, marginBottom: "1rem" }} />
                    <p style={{ color: "var(--text-3)", fontWeight: 600 }}>登録されたサイトはありません</p>
                  </div>
                ) : (
                  payload.sites.map((site) => (
                    <Link 
                      key={site.siteId} 
                      href={`/dashboard/sites/${site.siteId}`}
                      className="list-row"
                      style={{ 
                        gridTemplateColumns: "1.5fr 120px 1fr 1fr", 
                        display: "grid", 
                        gap: "1rem", 
                        alignItems: "center",
                        textDecoration: "none"
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: "var(--text)", fontSize: "0.9375rem" }}>{getDomain(site.url)}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{site.url}</div>
                      </div>

                      <div>
                        <StatusPill status={site.status} />
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                         <div style={{ flex: 1, height: "6px", background: "var(--surface-2)", borderRadius: "99px", overflow: "hidden", border: "1px solid var(--border)" }}>
                          <div style={{ 
                            height: "100%", 
                            width: `${site.healthScore}%`, 
                            background: site.healthScore >= 90 ? "var(--ok)" : site.healthScore >= 70 ? "var(--warn)" : "var(--danger)",
                            borderRadius: "99px" 
                          }} />
                        </div>
                        <span style={{ fontSize: "0.8125rem", fontWeight: 800, color: "var(--text-2)", fontFamily: "JetBrains Mono" }}>{site.healthScore}</span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-3)", fontSize: "0.8125rem", fontWeight: 500 }}>
                        <Clock size={14} style={{ opacity: 0.5 }} />
                        {site.lastCheckedAt ? new Date(site.lastCheckedAt).toLocaleString() : "-"}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .hover-emerald:hover {
          color: var(--emerald) !important;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

