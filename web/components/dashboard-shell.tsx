"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PropsWithChildren, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";

export function DashboardShell({ children }: PropsWithChildren) {
  const { user, loading, authError, signOutUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, router, user]);

  if (loading || !user) {
    return (
      <main className="shell-page">
        <div className="panel shell-loading-card">
          {authError ? <p className="error-text">{authError}</p> : <p>Checking your account...</p>}
        </div>
      </main>
    );
  }

  const navItems = [
    { href: "/dashboard", label: "ダッシュボード", icon: "01", active: pathname === "/dashboard" },
    {
      href: "/dashboard/customers",
      label: "顧客",
      icon: "02",
      active: pathname.startsWith("/dashboard/customers")
    },
    {
      href: "/dashboard/sites",
      label: "サイト",
      icon: "03",
      active: pathname.startsWith("/dashboard/sites")
    },
    {
      href: "/dashboard/alerts",
      label: "アラート",
      icon: "04",
      active: pathname.startsWith("/dashboard/alerts")
    },
    {
      href: "/dashboard/settings",
      label: "設定",
      icon: "05",
      active: pathname.startsWith("/dashboard/settings")
    }
  ];

  const pageTitle =
    navItems.find((item) => item.active)?.label ??
    (pathname.startsWith("/dashboard/add") ? "サイト追加" : "MIHARI");

  return (
    <main className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark" aria-hidden="true">
            M
          </div>
          <div>
            <p className="eyebrow">Web Monitoring SaaS</p>
            <h1 className="title-sm">MIHARI</h1>
            <p className="tiny-copy">制作会社向け監視ダッシュボード</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link key={item.href} className={item.active ? "sidebar-link active" : "sidebar-link"} href={item.href}>
              <span className="sidebar-link-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-account">
            <p className="tiny-copy">ログイン中</p>
            <p className="sidebar-account-email">{user.email}</p>
          </div>
          <Link
            href="/dashboard/add"
            className={pathname === "/dashboard/add" ? "btn btn-primary btn-add-website sidebar-add active" : "btn btn-primary btn-add-website sidebar-add"}
          >
            サイトを追加
          </Link>
          <button className="btn btn-muted" onClick={() => void signOutUser()}>
            ログアウト
          </button>
        </div>
      </aside>

      <section className="dashboard-content">
        <header className="dashboard-topbar">
          <div>
            <p className="eyebrow">Operations</p>
            <h2 className="dashboard-topbar-title">{pageTitle}</h2>
          </div>
          <div className="dashboard-topbar-actions">
            <div className="topbar-chip">
              <span className="topbar-chip-label">Workspace</span>
              <span>Agency CRM</span>
            </div>
            <Link href="/dashboard/add" className="btn btn-primary btn-add-website">
              新規サイト登録
            </Link>
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}
