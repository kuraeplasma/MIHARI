"use client";

import { useState, useEffect } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/components/auth-provider";
import { FileText, Download, Calendar, Globe, Filter, CheckCircle, ChevronRight } from "lucide-react";
import { SiteDoc } from "@/types/domain";

interface SitesResponse {
    sites: SiteDoc[];
}

function getDomain(url: string) {
    try { return new URL(url).hostname; } catch { return url; }
}

type ReportFormat = "pdf" | "csv";
type ReportPeriod = "7" | "30" | "90";

export default function ReportsPage() {
    const { apiFetch, token } = useAuth();
    const [sites, setSites] = useState<SiteDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [done, setDone] = useState(false);

    const [format, setFormat] = useState<ReportFormat>("pdf");
    const [period, setPeriod] = useState<ReportPeriod>("30");
    const [selectedSites, setSelectedSites] = useState<string[]>([]);
    const [includeAI, setIncludeAI] = useState(true);
    const [includeHistory, setIncludeHistory] = useState(true);

    useEffect(() => {
        if (!token) return;
        const load = async () => {
            try {
                const res = await apiFetch("/api/sites");
                if (!res.ok) throw new Error();
                const payload = (await res.json()) as SitesResponse;
                setSites(payload.sites);
                setSelectedSites(payload.sites.map(s => s.siteId));
            } catch {
                // mock data fallback
                setSites([
                    { siteId: "1", url: "https://example.com", healthScore: 98 } as SiteDoc,
                    { siteId: "2", url: "https://shop.client-a.jp", healthScore: 72 } as SiteDoc,
                    { siteId: "3", url: "https://corp.example.co.jp", healthScore: 45 } as SiteDoc,
                ]);
                setSelectedSites(["1", "2", "3"]);
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, [apiFetch, token]);

    const toggleSite = (siteId: string) => {
        setSelectedSites(prev =>
            prev.includes(siteId) ? prev.filter(id => id !== siteId) : [...prev, siteId]
        );
    };

    const handleGenerate = async () => {
        setGenerating(true);
        // Simulated generation delay
        await new Promise(r => setTimeout(r, 2000));
        setGenerating(false);
        setDone(true);
        setTimeout(() => setDone(false), 4000);
    };

    return (
        <DashboardShell>
            <div className="dashboard-main-padding">
                {/* Header */}
                <div style={{ marginBottom: "1rem" }}>
                    <p className="eyebrow">Export</p>
                    <h2 style={{ fontSize: "1.875rem", fontWeight: 800, letterSpacing: "-0.04em" }}>レポート出力</h2>
                    <p style={{ color: "var(--text-3)", fontSize: "0.9375rem", marginTop: "0.375rem" }}>
                        監視データをPDFまたはCSV形式でエクスポートします
                    </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "2rem", alignItems: "start" }}>
                    {/* Config Panel */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

                        {/* Period Selection - Unified History Tab Style */}
                        <div className="data-panel" style={{ padding: "1.5rem" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                    <Calendar size={18} style={{ color: "var(--emerald)" }} />
                                    <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text)" }}>対象期間</h3>
                                </div>
                                <div className="history-tab-group" style={{ background: "#f3f4f6", padding: "3px", borderRadius: "10px" }}>
                                    {([["7", "7日"], ["30", "30日"], ["90", "90日"]] as [ReportPeriod, string][]).map(([val, label]) => (
                                        <button
                                            key={val}
                                            onClick={() => setPeriod(val)}
                                            className={`history-tab ${period === val ? "active" : ""}`}
                                            style={{ fontSize: "0.75rem", padding: "0.35rem 1rem" }}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <p style={{ fontSize: "0.8125rem", color: "var(--text-4)" }}>選択した期間の監視ログと解析結果がレポートに含まれます。</p>
                        </div>

                        {/* Format Selection - Refined Design */}
                        <div className="data-panel" style={{ padding: "1.5rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
                                <FileText size={18} style={{ color: "var(--emerald)" }} />
                                <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text)" }}>出力形式</h3>
                            </div>
                            <div style={{ display: "flex", gap: "1rem" }}>
                                {([["pdf", "PDF レポート", "印刷・共有向け"], ["csv", "CSV データ", "スプレッドシート向け"]] as const).map(([val, label, desc]) => (
                                    <button
                                        key={val}
                                        onClick={() => setFormat(val)}
                                        className="data-panel"
                                        style={{
                                            flex: 1,
                                            padding: "1.25rem",
                                            textAlign: "left",
                                            cursor: "pointer",
                                            border: format === val ? "2px solid var(--emerald)" : "1px solid var(--border)",
                                            background: format === val ? "var(--emerald-glass)" : "white",
                                            transition: "all 0.2s var(--ease)",
                                            boxShadow: format === val ? "var(--shadow-sm)" : "none",
                                            position: "relative"
                                        }}
                                    >
                                        <div style={{ fontWeight: 800, color: format === val ? "var(--emerald)" : "var(--text)", fontSize: "0.9375rem" }}>{label}</div>
                                        <div style={{ fontSize: "0.75rem", color: "var(--text-3)", marginTop: "0.375rem" }}>{desc}</div>
                                        {format === val && (
                                            <div style={{ position: "absolute", top: "0.75rem", right: "0.75rem" }}>
                                                <CheckCircle size={16} style={{ color: "var(--emerald)" }} />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Data Options */}
                        <div className="data-panel" style={{ padding: "1.5rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
                                <Filter size={18} style={{ color: "var(--emerald)" }} />
                                <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text)" }}>含めるデータ</h3>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                {[
                                    { label: "AIリスク解析結果", desc: "AIによるリスク評価とサマリー", value: includeAI, setter: setIncludeAI },
                                    { label: "変更履歴タイムライン", desc: "検知されたコンテンツ変更の時系列", value: includeHistory, setter: setIncludeHistory },
                                ].map(option => (
                                    <label
                                        key={option.label}
                                        className="list-row"
                                        style={{
                                            padding: "1rem",
                                            borderRadius: "var(--r-md)",
                                            border: "1px solid var(--border)",
                                            cursor: "pointer",
                                            background: "white"
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={option.value}
                                            onChange={e => option.setter(e.target.checked)}
                                            style={{ display: "none" }}
                                        />
                                        <div style={{ display: "flex", alignItems: "center", gap: "1rem", width: "100%" }}>
                                            <div style={{
                                                width: "22px", height: "22px", borderRadius: "6px", border: "2px solid",
                                                borderColor: option.value ? "var(--emerald)" : "var(--border)",
                                                background: option.value ? "var(--emerald)" : "transparent",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                transition: "all 0.2s", flexShrink: 0
                                            }}>
                                                {option.value && <CheckCircle size={14} color="white" />}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--text)" }}>{option.label}</div>
                                                <div style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>{option.desc}</div>
                                            </div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Site Selection */}
                        <div className="data-panel">
                            <div className="panel-header" style={{ padding: "1rem 1.5rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                    <Globe size={18} style={{ color: "var(--emerald)" }} />
                                    <h3 className="panel-title">対象サイト</h3>
                                </div>
                                <button
                                    onClick={() => setSelectedSites(selectedSites.length === sites.length ? [] : sites.map(s => s.siteId))}
                                    className="btn btn-xs btn-ghost"
                                    style={{ color: "var(--emerald)", fontWeight: 700 }}
                                >
                                    {selectedSites.length === sites.length ? "全解除" : "全選択"}
                                </button>
                            </div>
                            <div className="card-list">
                                {loading ? (
                                    <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-3)", fontSize: "0.875rem" }}>
                                        <div style={{ width: "24px", height: "24px", border: "2px solid #f3f4f6", borderTopColor: "var(--emerald)", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 1rem" }} />
                                        読み込み中...
                                    </div>
                                ) : sites.length === 0 ? (
                                    <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-4)", fontSize: "0.875rem" }}>
                                        <Globe size={32} style={{ margin: "0 auto 1rem", opacity: 0.2 }} />
                                        サイトが登録されていません
                                    </div>
                                ) : (
                                    sites.map(site => (
                                        <label
                                            key={site.siteId}
                                            className="list-row"
                                            style={{
                                                cursor: "pointer",
                                                justifyContent: "space-between",
                                                padding: "1rem 1.5rem"
                                            }}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                                                <div style={{
                                                    width: "18px", height: "18px", borderRadius: "5px", border: "2px solid",
                                                    borderColor: selectedSites.includes(site.siteId) ? "var(--emerald)" : "var(--border)",
                                                    background: selectedSites.includes(site.siteId) ? "var(--emerald)" : "transparent",
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    transition: "all 0.2s", flexShrink: 0
                                                }}>
                                                    {selectedSites.includes(site.siteId) && <div style={{ width: "6px", height: "6px", background: "white", borderRadius: "1px" }} />}
                                                </div>
                                                <input type="checkbox" checked={selectedSites.includes(site.siteId)} onChange={() => toggleSite(site.siteId)} style={{ display: "none" }} />
                                                <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--text)" }}>{getDomain(site.url)}</span>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                                                <span className={`status-pill healthy`} style={{ fontSize: "0.6875rem" }}>Score: {site.healthScore}</span>
                                                <ChevronRight size={14} style={{ color: "var(--text-4)" }} />
                                            </div>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Preview / Generate Panel */}
                    <div style={{ position: "sticky", top: "calc(var(--header-h) + 2rem)" }}>
                        <div className="data-panel" style={{ overflow: "visible", boxShadow: "var(--shadow-lg)" }}>
                            <div className="panel-header" style={{ background: "white", borderBottom: "1px solid var(--border)", borderTopLeftRadius: "var(--r-lg)", borderTopRightRadius: "var(--r-lg)" }}>
                                <h3 className="panel-title" style={{ color: "var(--text)" }}>出力プレビュー</h3>
                                <div className={`badge ${format === "pdf" ? "badge-ok" : "badge-neutral"}`} style={{ fontSize: "0.625rem" }}>
                                    {format.toUpperCase()}
                                </div>
                            </div>
                            <div style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                                {[
                                    { label: "対象期間", value: `直近 ${period} 日間` },
                                    { label: "ファイル形式", value: format === "pdf" ? "PDF レポート" : "CSV データ" },
                                    { label: "対象サイト", value: `${selectedSites.length} サイト` },
                                    { label: "解析データ", value: includeAI ? "含む" : "含まない" },
                                    { label: "履歴データ", value: includeHistory ? "含む" : "含まない" },
                                ].map(row => (
                                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                                        <span style={{ color: "var(--text-3)", fontWeight: 500 }}>{row.label}</span>
                                        <span style={{ fontWeight: 700, color: "var(--text)" }}>{row.value}</span>
                                    </div>
                                ))}

                                <div style={{ height: "1px", background: "var(--border)", margin: "0.5rem 0" }} />

                                <button
                                    onClick={() => void handleGenerate()}
                                    disabled={generating || selectedSites.length === 0}
                                    className="btn btn-primary btn-lg"
                                    style={{
                                        width: "100%",
                                        gap: "0.75rem",
                                        boxShadow: selectedSites.length > 0 ? "var(--shadow-emerald)" : "none",
                                        opacity: selectedSites.length === 0 ? 0.3 : 1,
                                        cursor: selectedSites.length === 0 ? "not-allowed" : "pointer"
                                    }}
                                >
                                    {generating ? (
                                        <>
                                            <div style={{ width: "18px", height: "18px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                                            生成中...
                                        </>
                                    ) : done ? (
                                        <>
                                            <CheckCircle size={18} />
                                            成功
                                        </>
                                    ) : (
                                        <>
                                            <Download size={18} />
                                            レポートを生成
                                        </>
                                    )}
                                </button>

                                {selectedSites.length === 0 && (
                                    <p style={{ fontSize: "0.75rem", color: "var(--danger)", textAlign: "center", fontWeight: 600 }}>
                                        最低 1 つのサイトを選択してください
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <style jsx>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                .list-row:hover { background: var(--surface-2) !important; }
            `}</style>
        </DashboardShell>
    );
}
