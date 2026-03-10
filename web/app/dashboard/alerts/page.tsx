"use client";

import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/components/auth-provider";

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

export default function AlertsPage() {
  const { apiFetch, token } = useAuth();
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
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
        const res = await apiFetch("/api/alerts");
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error ?? "Failed to load alerts");
        }
        const payload = (await res.json()) as AlertsResponse;
        setAlerts(payload.alerts);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [apiFetch, token]);

  return (
    <DashboardShell>
      <section className="panel">
        <div className="section-head-copy">
          <h3>現在のアラート</h3>
          <p className="tiny-copy">発生中の問題、発生時間、現在状態を一覧で確認できます。</p>
        </div>
      </section>

      {loading && <p>Loading alerts...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && (
        <section className="panel">
          <table className="site-table">
            <thead>
              <tr>
                <th>サイト</th>
                <th>問題</th>
                <th>発生時間</th>
                <th>状態</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={alert.alertId}>
                  <td>
                    <div className="table-domain">
                      <span className="mono-link">{alert.domain}</span>
                      <span className="table-meta">{alert.type}</span>
                    </div>
                  </td>
                  <td>{alert.title || alert.type}</td>
                  <td>{new Date(alert.createdAt).toLocaleString()}</td>
                  <td>
                    <span className={alert.resolved ? "status-pill healthy" : "status-pill error"}>
                      {alert.resolved ? "解消済み" : "発生中"}
                    </span>
                  </td>
                </tr>
              ))}
              {alerts.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <div className="empty-state">現在アクティブなアラートはありません。</div>
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
