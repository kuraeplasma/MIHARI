"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { useAppPopup } from "@/components/app-popup-provider";
import { SiteDoc } from "@/types/domain";
import { Plus, Globe, Search, Trash2 } from "lucide-react";

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

function renderExpiryStatus(days: number | null | undefined) {
  if (days == null || Number.isNaN(days)) {
    return <span style={{ color: "var(--text-4)", fontSize: "0.82rem" }}>-</span>;
  }

  if (days < 0) {
    return (
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "0.15rem 0.45rem",
        borderRadius: "999px",
        background: "rgba(239,68,68,0.14)",
        color: "var(--danger)",
        fontWeight: 800,
        fontSize: "0.75rem"
      }}>
        期限切れ
      </span>
    );
  }

  if (days <= 7) {
    return <span style={{ color: "var(--danger)", fontWeight: 800, fontSize: "0.84rem" }}>! {days}日</span>;
  }

  if (days <= 30) {
    return <span style={{ color: "var(--warn)", fontWeight: 700, fontSize: "0.84rem" }}>⚠ {days}日</span>;
  }

  return <span style={{ color: "var(--ok)", fontWeight: 700, fontSize: "0.84rem" }}>✓ {days}日</span>;
}

export default function SitesPage() {
  const { apiFetch, token } = useAuth();
  const { confirmPopup, showPopup } = useAppPopup();
  const [sites, setSites] = useState<SiteDoc[]>([]);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiFetch("/api/sites");
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error ?? "サイト一覧の取得に失敗しました");
        }
        const payload = (await res.json()) as SitesResponse;
        setSites(payload.sites);
      } catch (e) {
        console.error("Failed to fetch sites:", e);
        setError(e instanceof Error ? e.message : "サイト一覧の取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [apiFetch, token]);

  const filteredSites = sites
    .filter(site => filter === "all" || site.status === "down" || site.status === "degraded")
    .filter(site => !search || getDomain(site.url).includes(search) || site.url.includes(search));

  const deleteSite = async (siteId: string) => {
    const confirmed = await confirmPopup("このサイトと全監視データを削除しますか？", {
      title: "サイト削除",
      confirmLabel: "削除する",
      cancelLabel: "キャンセル"
    });
    if (!confirmed) return;
    try {
      const res = await apiFetch(`/api/sites/${siteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("削除に失敗しました");
      setSites(prev => prev.filter(s => s.siteId !== siteId));
      showPopup("サイトを削除しました。", { title: "削除完了", tone: "success" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除エラー");
    }
  };

  const healthy = sites.filter(s => s.status === "healthy").length;
  const errors = sites.filter(s => s.status === "down").length;

  return (
    <>
      <div className="dashboard-main-padding">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "2rem" }}>
          <div>
            <p className="eyebrow">Sites</p>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)" }}>監視サイト一覧</h2>
            <p style={{ color: "var(--text-2)", fontSize: "0.9rem", marginTop: "0.25rem" }}>
              全 {sites.length} サイト — 正常 {healthy} / エラー {errors}
            </p>
          </div>
          <Link href="/dashboard/add" className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Plus size={16} />
            サイトを追加
          </Link>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
          <div className="segment-control">
            {(["all", "errors"] as FilterMode[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`segment-item ${filter === f ? "active" : ""}`}
              >
                {f === "all" ? "すべて" : "エラーのみ"}
              </button>
            ))}
          </div>
          <div className="search-control-wrap">
            <input
              placeholder="ドメインで検索..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="search-control-input"
            />
            <Search size={15} className="search-control-icon" />
          </div>
        </div>

        <div className="data-panel">
          {loading ? (
            <div className="empty-state">
              <Globe size={28} style={{ opacity: 0.2 }} />
              <p>読み込み中...</p>
            </div>
          ) : error ? (
            <div style={{ padding: "1.5rem", color: "var(--danger)", fontSize: "0.9rem" }}>{error}</div>
          ) : filteredSites.length === 0 ? (
            <div className="empty-state">
              <Globe size={32} style={{ opacity: 0.2 }} />
              <p>条件に一致するサイトがありません。</p>
              <Link href="/dashboard/add" className="btn btn-primary btn-xs" style={{ marginTop: "0.5rem" }}>
                サイトを追加
              </Link>
            </div>
          ) : (
            <>
              <div style={{ padding: "0.75rem 1.5rem", borderBottom: "1px solid var(--c-border)", display: "grid", gridTemplateColumns: "2fr 110px 110px 120px 140px 1fr 100px", gap: "0.75rem", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <span>ドメイン</span>
                <span>ステータス</span>
                <span>Health</span>
                <span>SSL</span>
                <span>ドメイン期限</span>
                <span>最終チェック</span>
                <span></span>
              </div>
              {filteredSites.map(site => (
                <div
                  key={site.siteId}
                  style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--c-border)", display: "grid", gridTemplateColumns: "2fr 110px 110px 120px 140px 1fr 100px", gap: "0.75rem", alignItems: "center", transition: "background 0.15s", color: "var(--text-2)" }}
                  className="issue-item"
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "2px", color: "var(--text)" }}>{getDomain(site.url)}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{site.url}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", fontWeight: 700, color: site.status === "down" ? "var(--danger)" : site.status === "degraded" ? "var(--warn)" : "var(--ok)" }}>
                    <span>{site.status === "down" ? "エラー" : site.status === "degraded" ? "警告" : "正常"}</span>
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                      <div style={{ flex: 1, height: "10px", background: "#f3f4f6", borderRadius: "999px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(site.healthScore ?? 0, 100)}%`, background: (site.healthScore ?? 0) >= 80 ? "#1db954" : (site.healthScore ?? 0) >= 50 ? "#f59e0b" : "#ef4444", borderRadius: "999px" }} />
                      </div>
                      <span style={{ fontSize: "0.85rem", fontWeight: 800, minWidth: "3ch", textAlign: "right", color: "var(--text)" }}>{site.healthScore}</span>
                    </div>
                  </div>
                  <div>{renderExpiryStatus(site.ssl_expiry_days)}</div>
                  <div>{renderExpiryStatus(site.domain_expiry_days)}</div>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-3)" }}>
                    {site.lastCheckedAt ? new Date(site.lastCheckedAt).toLocaleString() : "未実行"}
                  </span>
                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                    <Link href={`/dashboard/sites/${site.siteId}`} className="btn btn-muted btn-xs">詳細</Link>
                    <button
                      className="btn btn-xs"
                      onClick={() => void deleteSite(site.siteId)}
                      style={{ background: "rgba(239,68,68,0.08)", color: "var(--danger)", border: "none" }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}
