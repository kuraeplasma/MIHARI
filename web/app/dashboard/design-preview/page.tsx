"use client";

import Link from "next/link";

export default function DesignPreviewPage() {
    const variations = [
        {
            state: "SYSTEM ALERT",
            color: "var(--danger)",
            text: "3件の重大なエラーが検出されました。直ちに対応が必要です。",
            variant: "alert",
            monitorClass: "pipboy-monitor",
            description: "Pip-Boy: エラーステータス（赤）"
        },
        {
            state: "SYSTEM WARNING",
            color: "var(--warn)",
            text: "2件の警告があります。設定の確認を推奨します。",
            variant: "warning",
            monitorClass: "pipboy-monitor",
            description: "Pip-Boy: 警告ステータス（オレンジ）"
        },
        {
            state: "SYSTEM NORMAL",
            color: "var(--emerald)",
            text: "現在のシステムは正常に稼働しています。",
            variant: "stable",
            monitorClass: "pipboy-monitor",
            description: "Pip-Boy: 正常ステータス（緑）"
        },
    ];

    return (
        <>
            <div className="dashboard-main-padding" style={{ maxWidth: "1200px" }}>
                <header style={{ marginBottom: "2rem" }}>
                    <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.5rem" }}>ヒーローカード デザインプレビュー</h1>
                    <p style={{ color: "var(--text-3)", fontSize: "0.875rem" }}>
                        Pip-Boyスタイル採用版（3パターン: alert / warning / stable）の確認ページです。
                    </p>
                </header>

                <div style={{ display: "flex", flexDirection: "column", gap: "3rem" }}>
                    {variations.map((v, idx) => (
                        <div key={idx} style={{ borderBottom: "1px solid var(--border)", paddingBottom: "3rem" }}>
                            <div style={{ marginBottom: "1.5rem" }}>
                                <span style={{
                                    fontSize: "0.75rem",
                                    fontWeight: 900,
                                    color: v.color,
                                    background: `${v.color}15`,
                                    padding: "0.25rem 0.6rem",
                                    borderRadius: "4px",
                                    letterSpacing: "0.1em"
                                }}>
                                    {v.state}
                                </span>
                                <p style={{ marginTop: "0.75rem", fontSize: "0.875rem", color: "var(--text-2)" }}>{v.description}</p>
                            </div>

                            <section className={`hero-monitor-outer`}>
                                <div className={`hero-monitor-inner ${v.variant} ${v.monitorClass}`}>
                                    <div className="monitor-vignette" />

                                    <div className="monitor-content">
                                        <div style={{ flex: 1 }}>
                                            <p style={{
                                                fontSize: "0.75rem",
                                                fontWeight: 700,
                                                opacity: 0.6,
                                                marginBottom: "0.6rem",
                                                color: v.color
                                            }}>
                                                SYSTEM_STATUS_MONITOR // {v.state === "SYSTEM NORMAL" ? "STABLE" : "ALERT"}
                                            </p>
                                            <h2 className="welcome-title monitor-text" style={{
                                                fontSize: "1.375rem",
                                                color: v.color,
                                                marginBottom: 0,
                                                lineHeight: "1.2",
                                                fontWeight: 800,
                                                wordBreak: "keep-all"
                                            }}>
                                                {">"} {v.text}
                                            </h2>
                                        </div>

                                        <div className="welcome-actions" style={{
                                            marginTop: 0,
                                            position: "relative",
                                            zIndex: 10,
                                            display: "flex",
                                            gap: "0.875rem",
                                            flexShrink: 0
                                        }}>
                                            <Link href="/dashboard/sites" className="btn monitor-btn monitor-btn-primary" style={{
                                                padding: "0.75rem 1.75rem",
                                                borderRadius: "6px"
                                            }}>
                                                監視一覧へ
                                            </Link>
                                            <Link href="/dashboard/alerts" className="btn monitor-btn monitor-btn-ghost" style={{
                                                padding: "0.75rem 1.75rem",
                                                borderRadius: "6px"
                                            }}>
                                                アラートを確認
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    ))}
                </div>

                <section style={{ marginTop: "4rem", background: "var(--surface-2)", padding: "2rem", borderRadius: "var(--r-lg)", border: "1px solid var(--border)" }}>
                    <h3 style={{ fontSize: "1rem", fontWeight: 800, marginBottom: "1rem" }}>修正の技術的メモ</h3>
                    <ul style={{ fontSize: "0.875rem", color: "var(--text-2)", display: "flex", flexDirection: "column", gap: "0.5rem", paddingLeft: "1.25rem" }}>
                        <li><strong>垂直中央揃え:</strong> <code>align-items: center</code> を <code>monitor-content</code> に適用し、ボタンとテキストの高さがズレる問題を解消。</li>
                        <li><strong>改行の制御:</strong> <code>line-height</code> を調整し、<code>word-break: keep-all</code> を追加。また <code>padding</code> を最適化して余裕を持たせました。</li>
                        <li><strong>視認性向上:</strong> テキストサイズを 1.25rem → 1.375rem に微増。ボタンの <code>font-weight</code> を強化（900 → 950）し、モニターへの「焼き付き」感をアップ。</li>
                        <li><strong>枠線の強化:</strong> <code>btn-ghost</code> の <code>border-width</code> を 2px に設定し、より「Pip-Boy」らしい物理的なボタン感を演出。</li>
                    </ul>
                </section>
            </div>
        </>
    );
}


