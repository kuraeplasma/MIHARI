"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PropsWithChildren, useEffect } from "react";
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
  Users,
  ChevronRight
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/dashboard/sites", label: "監視サイト", icon: Globe },
  { href: "/dashboard/alerts", label: "検出アラート", icon: Bell },
  { href: "/dashboard/history", label: "変更履歴", icon: History },
  { href: "/dashboard/ai-reports", label: "AI解析レポート", icon: BarChart3 },
  { href: "/dashboard/customers", label: "顧客管理", icon: Users },
  { href: "/dashboard/reports", label: "レポート出力", icon: FileText },
  { href: "/dashboard/settings", label: "設定", icon: Settings },
] as const;

export function DashboardShell({ children }: PropsWithChildren) {
  const { user, loading, authError } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const allowLocalDashboardBypass = process.env.NEXT_PUBLIC_LOCAL_DASHBOARD_BYPASS === "1";
  const showDashboardContent = !loading && (Boolean(user) || allowLocalDashboardBypass);
  const showBlockingOverlay = loading || (!user && !allowLocalDashboardBypass);

  useEffect(() => {
    if (!loading && !user && !allowLocalDashboardBypass) router.replace("/");
  }, [allowLocalDashboardBypass, loading, router, user]);

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
          </div>
        </div>
      </aside>

      {/* ─── Main ─── */}
      <div className="dashboard-content">
        {/* Page content */}
        {showDashboardContent && children}

        {/* Loading Overlay */}
        {showBlockingOverlay && (
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
