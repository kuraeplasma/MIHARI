"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/components/auth-provider";
import { SiteDoc } from "@/types/domain";

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
  const [newClientName, setNewClientName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [clientsRes, sitesRes] = await Promise.all([apiFetch("/api/clients"), apiFetch("/api/sites")]);
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
    if (!name) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const res = await apiFetch("/api/clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name })
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to create client");
      }
      setClients((prev) => [json.client as ClientRow, ...prev]);
      setNewClientName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create client");
    } finally {
      setSaving(false);
    }
  };

  const errorCountByClient = useMemo(() => {
    return sites.reduce<Record<string, number>>((acc, site) => {
      if (!site.clientId) {
        return acc;
      }
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

  return (
    <DashboardShell>
      <section className="panel">
        <div className="section-head">
          <div className="section-head-copy">
            <h3>顧客CRM</h3>
            <p className="tiny-copy">顧客ごとの管理サイト数とエラー数をまとめて確認できます。</p>
          </div>
          <form className="inline-form-row" onSubmit={addClient}>
            <input
              type="text"
              className="input"
              placeholder="顧客名を入力"
              value={newClientName}
              onChange={(event) => setNewClientName(event.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={saving}>
              顧客追加
            </button>
          </form>
        </div>
      </section>

      <section className="metrics-grid">
        <article className="metric-card">
          <p className="tiny-copy">顧客数</p>
          <strong className="metric-value">{clients.length}</strong>
        </article>
        <article className="metric-card">
          <p className="tiny-copy">管理サイト総数</p>
          <strong className="metric-value">{clients.reduce((sum, client) => sum + client.siteCount, 0)}</strong>
        </article>
        <article className="metric-card">
          <p className="tiny-copy">顧客配下のエラー数</p>
          <strong className="metric-value">{totalErrors}</strong>
        </article>
      </section>

      {loading && <p>Loading clients...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && (
        <section className="panel">
          <table className="site-table">
            <thead>
              <tr>
                <th>顧客名</th>
                <th>管理サイト数</th>
                <th>エラー数</th>
                <th>最終チェック</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.clientId}>
                  <td>
                    <div className="table-domain">
                      <Link href={`/dashboard/customers/${client.clientId}`} className="mono-link">
                        {client.name}
                      </Link>
                      <span className="table-meta">顧客詳細を表示</span>
                    </div>
                  </td>
                  <td>{client.siteCount}サイト</td>
                  <td>{errorCountByClient[client.clientId] ?? 0}</td>
                  <td>{client.lastCheckedAt ? new Date(client.lastCheckedAt).toLocaleString() : "-"}</td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <div className="empty-state">顧客が登録されていません。</div>
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
