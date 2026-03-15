"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { SiteDoc } from "@/types/domain";
import { 
  Users, 
  Globe, 
  AlertTriangle, 
  Search, 
  ChevronRight
} from "lucide-react";

interface ClientRow {
  clientId: string;
  name: string;
  siteCount: number;
  lastCheckedAt: string | null;
}

interface ClientsResponse {
  clients: ClientRow[];
}

interface SitesResponse {
  sites: SiteDoc[];
}

export default function CustomersPage() {
  const { apiFetch, token } = useAuth();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [sites, setSites] = useState<SiteDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [clientsRes, sitesRes] = await Promise.all([
          apiFetch("/api/clients"), 
          apiFetch("/api/sites")
        ]);
        
        if (!clientsRes.ok) {
          const json = await clientsRes.json();
          throw new Error(json.error ?? "Failed to load clients");
        }
        const clientsPayload = (await clientsRes.json()) as ClientsResponse;
        setClients(clientsPayload.clients);

        if (sitesRes.ok) {
          const sitesPayload = (await sitesRes.json()) as SitesResponse;
          setSites(sitesPayload.sites);
        } else {
          setSites([]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [apiFetch, token]);

  const addClient = async (event: FormEvent) => {
    event.preventDefault();
    const name = newClientName.trim();
    if (!name) return;

    try {
      setSaving(true);
      setError(null);
      const res = await apiFetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create client");
      
      setClients((prev) => [json.client as ClientRow, ...prev]);
      setNewClientName("");
      // Success micro-feedback could go here
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create client");
    } finally {
      setSaving(false);
    }
  };

  const errorCountByClient = useMemo(() => {
    return sites.reduce<Record<string, number>>((acc, site) => {
      if (!site.clientId) return acc;
      if (site.status === "down" || site.status === "degraded") {
        acc[site.clientId] = (acc[site.clientId] ?? 0) + 1;
      }
      return acc;
    }, {});
  }, [sites]);

  const totalErrors = useMemo(
    () => Object.values(errorCountByClient).reduce((sum, count) => sum + count, 0),
    [errorCountByClient]
  );

  const filteredClients = clients.filter(c => 
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="dashboard-main-padding">
        {/* Header Section */}
        <div className="page-header">
          <div>
            <span className="page-eyebrow">Client Relationship Management</span>
            <h1 className="page-title">顧客管理</h1>
            <p className="page-subtitle">監視対象の顧客・ブランドごとの状況を俯瞰できます。</p>
          </div>
          
          <form className="search-control-wrap" onSubmit={addClient} style={{ maxWidth: "320px", width: "100%" }}>
            <input
              type="text"
              className="search-control-input"
              placeholder="新規顧客名を入力..."
              style={{ paddingLeft: "1rem", paddingRight: "4rem" }}
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
            />
            <button 
              type="submit" 
              disabled={saving || !newClientName.trim()} 
              style={{ 
                position: "absolute", 
                right: "4px", 
                top: "4px", 
                bottom: "4px", 
                padding: "0 1rem",
                background: "var(--emerald)",
                color: "white",
                border: "none",
                borderRadius: "var(--r-md)",
                fontSize: "0.75rem",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              {saving ? "..." : "追加"}
            </button>
          </form>
        </div>

        {/* KPI Section */}
        <div className="kpi-grid">
           <div className="kpi-card">
            <div className="kpi-top">
              <span className="kpi-label">登録顧客数</span>
              <div className="kpi-icon-wrap" style={{ color: "var(--info)" }}><Users size={18} /></div>
            </div>
            <div className="kpi-value">{clients.length}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-top">
              <span className="kpi-label">管理サイト総数</span>
              <div className="kpi-icon-wrap" style={{ color: "var(--emerald)" }}><Globe size={18} /></div>
            </div>
            <div className="kpi-value">{clients.reduce((sum, client) => sum + client.siteCount, 0)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-top">
              <span className="kpi-label">異常検知中</span>
              <div className="kpi-icon-wrap" style={{ color: "var(--danger)" }}><AlertTriangle size={18} /></div>
            </div>
            <div className="kpi-value">{totalErrors}</div>
          </div>
        </div>

        {/* Main List */}
        <div className="data-panel">
          <div className="panel-header">
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <h3 className="panel-title">顧客リスト</h3>
              <div className="search-control-wrap" style={{ minWidth: "240px" }}>
                <input
                  placeholder="顧客を検索..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="search-control-input"
                  style={{ height: "32px", fontSize: "0.8125rem" }}
                />
                <Search size={14} className="search-control-icon" />
              </div>
            </div>
          </div>

          {loading ? (
             <div className="empty-state" style={{ padding: "4rem" }}>
              <div style={{ width: "32px", height: "32px", border: "2px solid var(--border)", borderTopColor: "var(--emerald)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              <p style={{ marginTop: "1rem" }}>読み込み中...</p>
            </div>
          ) : error ? (
            <div style={{ padding: "2rem", color: "var(--danger)", textAlign: "center", fontSize: "0.9375rem", fontWeight: 600 }}>
              {error}
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="empty-state" style={{ padding: "4rem" }}>
              <Users size={40} style={{ opacity: 0.1, marginBottom: "1rem" }} />
              <p style={{ color: "var(--text-3)", fontWeight: 600 }}>顧客が見つかりません</p>
            </div>
          ) : (
            <div className="card-list">
              <div style={{ 
                padding: "0.75rem 1.5rem", 
                borderBottom: "1px solid var(--border)", 
                display: "grid", 
                gridTemplateColumns: "2fr 120px 100px 1fr 100px", 
                gap: "1rem", 
                fontSize: "0.6875rem", 
                fontWeight: 800, 
                color: "var(--text-4)", 
                textTransform: "uppercase", 
                letterSpacing: "0.08em" 
              }}>
                <span>顧客名</span>
                <span>管理サイト</span>
                <span>アラート</span>
                <span>最終チェック</span>
                <span></span>
              </div>
              
              {filteredClients.map((client) => {
                const hasError = (errorCountByClient[client.clientId] ?? 0) > 0;
                return (
                  <Link 
                    key={client.clientId} 
                    href={`/dashboard/customers/${client.clientId}`}
                    className="list-row"
                    style={{ 
                      gridTemplateColumns: "2fr 120px 100px 1fr 100px", 
                      display: "grid", 
                      gap: "1rem", 
                      alignItems: "center",
                      textDecoration: "none"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <div style={{ 
                        width: "36px", 
                        height: "36px", 
                        borderRadius: "10px", 
                        background: hasError ? "var(--danger-bg)" : "var(--emerald-glass)", 
                        color: hasError ? "var(--danger)" : "var(--emerald)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        <Users size={18} />
                      </div>
                      <span style={{ fontWeight: 700, color: "var(--text)" }}>{client.name}</span>
                    </div>

                    <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-2)" }}>
                      {client.siteCount} <span style={{ fontSize: "0.65rem", color: "var(--text-4)" }}>SITES</span>
                    </div>

                    <div>
                       <span style={{ 
                        fontSize: "0.75rem", 
                        fontWeight: 800, 
                        padding: "2px 8px", 
                        borderRadius: "999px",
                        background: hasError ? "var(--danger-bg)" : "var(--surface-2)",
                        color: hasError ? "var(--danger)" : "var(--text-4)",
                        border: hasError ? "1px solid rgba(239,68,68,0.2)" : "1px solid var(--border)"
                      }}>
                        {errorCountByClient[client.clientId] ?? 0}
                      </span>
                    </div>

                    <div style={{ fontSize: "0.8125rem", color: "var(--text-3)", fontWeight: 500 }}>
                      {client.lastCheckedAt ? new Date(client.lastCheckedAt).toLocaleString() : "-"}
                    </div>

                    <div style={{ textAlign: "right", color: "var(--text-4)" }}>
                      <ChevronRight size={18} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

