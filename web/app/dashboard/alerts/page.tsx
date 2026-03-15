"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { AlertTriangle, CheckCircle, Globe, Search, Bell } from "lucide-react";

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

function getTypeStyle(type: string) {
  if (type === "down" || type === "error") return { label: "エラー", bg: "rgba(239,68,68,0.08)", color: "var(--danger)" };
  if (type === "content_change") return { label: "変更検知", bg: "rgba(16,185,129,0.08)", color: "var(--brand-emerald)" };
  if (type === "ssl") return { label: "[ssl]", bg: "rgba(245,158,11,0.12)", color: "#b45309" };
  if (type === "domain") return { label: "[domain]", bg: "rgba(245,158,11,0.12)", color: "#b45309" };
  return { label: type, bg: "#f3f4f6", color: "#6b7280" };
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}分前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}時間前`;
  return new Date(dateStr).toLocaleDateString("ja-JP");
}

export default function AlertsPage() {
  const { apiFetch, token } = useAuth();
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("all");

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        setLoading(true);
        const res = await apiFetch("/api/alerts");
        if (!res.ok) throw new Error("アラート取得に失敗しました");
        const payload = (await res.json()) as AlertsResponse;
        setAlerts(payload.alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      } catch (e) {
        console.error("Failed to fetch alerts:", e);
        setError(e instanceof Error ? e.message : "アラート取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [apiFetch, token]);

  const filtered = alerts
    .filter(a => filter === "all" || (filter === "active" ? !a.resolved : a.resolved))
    .filter(a => !search || a.domain?.includes(search) || a.title?.includes(search));

  const active = alerts.filter(a => !a.resolved).length;
  const resolved = alerts.filter(a => a.resolved).length;

  return (
    <>
      <div className="dashboard-main-padding">
        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <p className="eyebrow">Alerts</p>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.03em" }}>検出アラート</h2>
          <p style={{ color: "var(--c-text-muted)", fontSize: "0.9rem", marginTop: "0.25rem" }}>
            サイト変更・障害の検知通知一覧
          </p>
        </div>

        {/* Summary Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
          {[
            { label: "総アラート数", value: alerts.length, icon: <Bell size={18} style={{ color: "var(--brand-emerald)" }} /> },
            { label: "未解消", value: active, icon: <AlertTriangle size={18} style={{ color: "var(--danger)" }} /> },
            { label: "解消済み", value: resolved, icon: <CheckCircle size={18} style={{ color: "var(--brand-emerald)" }} /> },
          ].map(card => (
            <div key={card.label} className="kpi-card" style={{ flexDirection: "row", alignItems: "center", gap: "1.25rem" }}>
              <div style={{ padding: "0.75rem", background: "#f9fafb", borderRadius: "10px" }}>
                {card.icon}
              </div>
              <div>
                <p className="kpi-label">{card.label}</p>
                <span className="kpi-value" style={{ fontSize: "1.5rem" }}>{loading ? "—" : card.value}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Filter & Search */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
          <div className="segment-control">
            {(["all", "active", "resolved"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`segment-item ${filter === f ? "active" : ""}`}
              >
                {f === "all" ? "すべて" : f === "active" ? "未解消" : "解消済み"}
              </button>
            ))}
          </div>
          <div className="search-control-wrap">
            <input
              placeholder="ドメイン・タイトルで検索..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="search-control-input"
            />
            <Search size={15} className="search-control-icon" />
          </div>
        </div>

        {/* Alert List */}
        <div className="data-panel">
          {loading ? (
            <div className="empty-state">
              <Bell size={28} style={{ opacity: 0.2 }} />
              <p>読み込み中...</p>
            </div>
          ) : error ? (
            <div style={{ padding: "1.5rem", color: "var(--danger)", fontSize: "0.9rem" }}>{error}</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <Globe size={32} style={{ opacity: 0.2 }} />
              <p>現在アラートはありません</p>
            </div>
          ) : (
            <div className="card-list">
              {filtered.map(alert => {
                const ts = getTypeStyle(alert.type);
                return (
                  <div key={alert.alertId} className="issue-item">
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", flex: 1 }}>
                      <div style={{
                        width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0,
                        background: alert.resolved ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                        display: "flex", alignItems: "center", justifyContent: "center"
                      }}>
                        {alert.resolved
                          ? <CheckCircle size={17} style={{ color: "var(--brand-emerald)" }} />
                          : <AlertTriangle size={17} style={{ color: "var(--danger)" }} />
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                          <span className="domain-name">{alert.domain || "(不明なドメイン)"}</span>
                          <span style={{ padding: "0.1rem 0.5rem", borderRadius: "999px", fontSize: "0.7rem", fontWeight: 700, background: ts.bg, color: ts.color }}>
                            {ts.label}
                          </span>
                        </div>
                        <p className="issue-desc" style={{ marginTop: "0.2rem" }}>
                          {alert.title || `監視イベント: ${alert.type}`}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--c-text-muted)" }}>{relativeTime(alert.createdAt)}</span>
                      <span style={{
                        padding: "0.2rem 0.65rem",
                        borderRadius: "999px",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        background: alert.resolved ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                        color: alert.resolved ? "var(--brand-emerald)" : "var(--danger)"
                      }}>
                        {alert.resolved ? "解消" : "未解消"}
                      </span>
                    </div>
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

