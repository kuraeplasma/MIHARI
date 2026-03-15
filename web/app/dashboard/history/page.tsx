"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { History } from "lucide-react";
import Link from "next/link";

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

function getTypeBadgeLabel(type: string) {
    const labels: Record<string, string> = {
        "down": "サーバーダウン",
        "error": "エラー",
        "form": "フォーム異常",
        "rendering": "レイアウト崩れ",
        "content_change": "コンテンツ更新",
        "links": "リンク切れ",
        "ssl": "[ssl]",
        "domain": "[domain]",
    };
    return labels[type] || type;
}

function relativeTime(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}分前`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}時間前`;
    return `${Math.floor(hrs / 24)}日前`;
}

function groupByDate(alerts: AlertRow[]) {
    const map = new Map<string, AlertRow[]>();
    for (const a of alerts) {
        const date = new Date(a.createdAt).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
        if (!map.has(date)) map.set(date, []);
        map.get(date)!.push(a);
    }
    return map;
}

export default function HistoryPage() {
    const { apiFetch, token } = useAuth();
    const [alerts, setAlerts] = useState<AlertRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterMode, setFilterMode] = useState<"all" | "unresolved" | "resolved">("all");
    const [siteFilter, setSiteFilter] = useState("all");
    const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(7);

    useEffect(() => {
        if (!token) return;
        const load = async () => {
            try {
                setLoading(true);
                const res = await apiFetch("/api/alerts");
                if (!res.ok) throw new Error("変更履歴の取得に失敗しました");
                const payload = (await res.json()) as AlertsResponse;
                setAlerts(payload.alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
            } catch (e) {
                setError(e instanceof Error ? e.message : "Unknown error");
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, [apiFetch, token]);

    const domains = Array.from(new Set(alerts.map(a => a.domain)));
    const unresolvedCount = alerts.filter(a => !a.resolved).length;
    const resolvedCount = alerts.filter(a => a.resolved).length;

    const filteredAlerts = alerts.filter(a => {
        if (filterMode === "unresolved" && a.resolved) return false;
        if (filterMode === "resolved" && !a.resolved) return false;
        if (siteFilter !== "all" && a.domain !== siteFilter) return false;
        const createdAtMs = new Date(a.createdAt).getTime();
        const thresholdMs = Date.now() - rangeDays * 24 * 60 * 60 * 1000;
        if (Number.isFinite(createdAtMs) && createdAtMs < thresholdMs) return false;
        return true;
    });

    const grouped = groupByDate(filteredAlerts);

    return (
        <>
            <div className="dashboard-main-padding">
                <div style={{ marginBottom: "1.5rem" }}>
                    <p className="eyebrow">Change Log</p>
                    <h2 style={{ fontSize: "1.875rem", fontWeight: 800, letterSpacing: "-0.04em" }}>変更履歴</h2>
                </div>

                {error && (
                    <div style={{ marginBottom: "1rem", color: "var(--danger)", fontSize: "0.875rem", fontWeight: 600 }}>
                        {error}
                    </div>
                )}

                {/* Filter Bar */}
                <div className="history-filter-bar">
                    <div className="history-tab-group">
                        <button
                            className={`history-tab ${filterMode === "all" ? "active" : ""}`}
                            onClick={() => setFilterMode("all")}
                        >
                            すべて
                        </button>
                        <button
                            className={`history-tab ${filterMode === "unresolved" ? "active" : ""}`}
                            onClick={() => setFilterMode("unresolved")}
                        >
                            未解消 <span className="history-tab-count">{unresolvedCount}</span>
                        </button>
                        <button
                            className={`history-tab ${filterMode === "resolved" ? "active" : ""}`}
                            onClick={() => setFilterMode("resolved")}
                        >
                            解決済み <span className="history-tab-count">{resolvedCount}</span>
                        </button>
                    </div>

                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                        <select
                            className="history-dropdown"
                            value={siteFilter}
                            onChange={(e) => setSiteFilter(e.target.value)}
                        >
                            <option value="all">すべてのサイト</option>
                            {domains.map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>

                        <div className="history-tab-group">
                            {([7, 30, 90] as const).map((days) => (
                                <button
                                    key={days}
                                    type="button"
                                    onClick={() => setRangeDays(days)}
                                    className={`history-tab ${rangeDays === days ? "active" : ""}`}
                                    style={{ fontSize: "0.75rem", padding: "0.3rem 0.75rem" }}
                                >
                                    {days === 7 ? "直近7日" : `${days}日`}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div style={{ padding: "4rem", textAlign: "center", color: "var(--c-text-muted)" }}>
                        読み込み中...
                    </div>
                ) : filteredAlerts.length === 0 ? (
                    <div className="data-panel" style={{ padding: "4rem", textAlign: "center" }}>
                        <History size={48} style={{ margin: "0 auto 1rem", opacity: 0.1 }} />
                        <p style={{ color: "var(--c-text-muted)" }}>表示する履歴がありません</p>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
                        {Array.from(grouped.entries()).map(([date, dayAlerts]) => (
                            <div key={date}>
                                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
                                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-2)" }}>{date}</span>
                                    <div style={{ height: "1px", flex: 1, background: "var(--border)" }} />
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                    {dayAlerts.map((alert) => (
                                        <Link
                                            key={alert.alertId}
                                            href={`/dashboard/sites/${alert.siteId}`}
                                            className="data-panel"
                                            style={{
                                                display: "block",
                                                padding: "1.25rem 1.5rem",
                                                textDecoration: "none",
                                                transition: "transform 0.2s var(--ease), box-shadow 0.2s var(--ease)",
                                                cursor: "pointer"
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = "translateY(-2px)";
                                                e.currentTarget.style.boxShadow = "var(--shadow-md)";
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = "translateY(0)";
                                                e.currentTarget.style.boxShadow = "var(--shadow-xs)";
                                            }}
                                        >
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                                    <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>🌐 {alert.domain}</span>
                                                    <span style={{
                                                        fontSize: "0.7rem",
                                                        fontWeight: 700,
                                                        padding: "0.2rem 0.5rem",
                                                        borderRadius: "4px",
                                                        background: "var(--surface-2)",
                                                        border: "1px solid var(--border)",
                                                        color: "var(--text-3)",
                                                        textTransform: "uppercase"
                                                    }}>
                                                        {getTypeBadgeLabel(alert.type)}
                                                    </span>
                                                </div>
                                                <span style={{ fontSize: "0.75rem", color: "var(--text-4)", fontWeight: 500 }}>{relativeTime(alert.createdAt)}</span>
                                            </div>

                                            <p style={{ fontSize: "0.9375rem", color: "var(--text-2)", marginBottom: "0.75rem", fontWeight: 500 }}>
                                                {alert.title}
                                            </p>

                                            <span className={`status-badge ${alert.resolved ? "resolved" : "unresolved"}`}>
                                                {alert.resolved ? "解決済み" : "未解消"}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

