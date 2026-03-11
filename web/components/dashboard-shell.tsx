"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PropsWithChildren, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  LayoutDashboard,
  Globe,
  Bell,
  History,
  BarChart3,
  FileText,
  Settings,
  PlusCircle,
  LogOut,
  ChevronRight
} from "lucide-react";
import { StatusPill } from "@/components/status-pill";

const NAV = [
  { href: "/dashboard", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/dashboard/sites", label: "監視サイト", icon: Globe },
  { href: "/dashboard/alerts", label: "検出アラート", icon: Bell },
  { href: "/dashboard/history", label: "変更履歴", icon: History },
  { href: "/dashboard/ai-reports", label: "AI解析レポート", icon: BarChart3 },
  { href: "/dashboard/reports", label: "レポート出力", icon: FileText },
  { href: "/dashboard/settings", label: "設定", icon: Settings },
] as const;

export function DashboardShell({ children }: PropsWithChildren) {
  const { user, loading, authError, signOutUser, apiFetch } = useAuth();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, router, user]);

  useEffect(() => {
    if (!user) return;
    apiFetch("/api/me").then(res => res.ok ? res.json() : null).then(data => {
      if (data?.displayName) setDisplayName(data.displayName);
    }).catch(() => { });
  }, [user, apiFetch]);

  return (
    <div className="dashboard-layout" style={{ position: "relative" }}>
      {/* ─── Sidebar ─── */}
      <aside className="sidebar">
        <div className="sidebar-inner">
          {/* Logo */}
          <div className="logo-container">
            <img src="/logo_transparent.png" alt="MIHARI logo" />
            <span className="logo-wordmark">MIHARI</span>
          </div>

          {/* Nav */}
          <nav className="sidebar-nav">
            {NAV.map(item => {
              const active = item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className={`sidebar-link${active ? " active" : ""}`}>
                  <span className="sidebar-link-icon">
                    <Icon size={16} strokeWidth={active ? 2.5 : 2} />
                  </span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {active && <ChevronRight size={14} style={{ opacity: 0.5 }} />}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="sidebar-footer">
            <Link
              href="/dashboard/add"
              className="btn btn-primary btn-sm"
              style={{ width: "100%", borderRadius: "10px", justifyContent: "center" }}
            >
              <PlusCircle size={15} />
              サイトを追加
            </Link>
            <div className="sidebar-account">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#10b981" }}>LIVE</span>
                <StatusPill status="healthy" />
              </div>
              <p className="sidebar-account-email" style={{ marginTop: "0.25rem", color: "var(--text)" }}>{displayName || user?.displayName || "読み込み中..."}</p>
              <p className="sidebar-account-email" style={{ marginTop: "0.1rem", fontSize: "0.65rem", color: "var(--text-3)" }}>{user?.email}</p>
            </div>
            <button
              className="btn btn-ghost btn-xs"
              style={{ width: "100%", color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.06)" }}
              onClick={() => { if (user) void signOutUser() }}
            >
              <LogOut size={13} />
              ログアウト
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main ─── */}
      <div className="dashboard-content">
        {/* Page content */}
        {(!loading && user) && children}

        {/* Loading Overlay */}
        {(loading || !user) && (
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100,
            display: "grid", placeItems: "center",
            background: "rgba(255,255,255,0.4)", backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}>
            {authError ? (
              <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "1rem", padding: "2rem" }}>
                <div style={{ fontSize: "2rem" }}>⚠️</div>
                <p style={{ color: "var(--text)", fontWeight: 600 }}>{authError}</p>
                <button className="btn btn-primary" onClick={() => window.location.reload()}>
                  再読み込み
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem" }}>
                <div style={{
                  width: "160px", height: "3px", background: "rgba(0,0,0,0.05)", borderRadius: "4px", overflow: "hidden", position: "relative"
                }}>
                  <div style={{
                    position: "absolute", top: 0, left: 0, height: "100%", width: "40%",
                    background: "var(--emerald)", borderRadius: "4px",
                    animation: "shimmerLoad 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite"
                  }} />
                </div>
                <p style={{ color: "var(--text-3)", fontSize: "0.8125rem", letterSpacing: "0.08em", fontWeight: 700, textTransform: "uppercase" }}>Loading MIHARI</p>
              </div>
            )}
            <style>{`
              @keyframes shimmerLoad {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(350%); }
              }
            `}</style>
          </div>
        )}
      </div>
    </div>
  );
}
