"use client";

import { useState } from "react";
import {
    User, Building2, Shield, Bell, Sparkles, CreditCard,
    Camera, ChevronRight, Check, AlertCircle, Crown, Globe
} from "lucide-react";
import { PlanChangeModal } from "@/components/plan-change-modal";
import { getFirebaseClient } from "@/lib/firebase-client";
import { sendPasswordResetEmail } from "firebase/auth";
import { useAuth } from "@/components/auth-provider";

// ─── Types ───────────────────────────────────────────
type Tab = "account" | "workspace" | "monitoring" | "notifications" | "ai" | "billing";

interface MeData {
    displayName?: string;
    email: string;
    plan: string;
    sitesUsed: number;
    sitesMax: number;
    aiUsed: number;
    aiMax: number;
    workspaceName?: string;
    settings?: {
        monitoring?: { interval: "5m" | "15m" | "1h" | "6h" | "24h"; algorithm: "dom" | "text" | "html" };
        notifications?: { emailEnabled: boolean; slackEnabled: boolean; slackWebhookUrl?: string; notifyOn: "all" | "errors" | "critical" };
        ai?: { autoAnalyze: boolean; scope: "full" | "summary" };
    }
}

// ─── Primitives ───────────────────────────────────────

function SettingRow({
    label,
    description,
    children,
}: {
    label: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "2rem",
            padding: "1.25rem 0",
            borderBottom: "1px solid var(--border)",
        }}>
            <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--text)" }}>{label}</p>
                {description && (
                    <p style={{ fontSize: "0.8125rem", color: "var(--text-3)", marginTop: "0.25rem", lineHeight: 1.5 }}>
                        {description}
                    </p>
                )}
            </div>
            <div style={{ flexShrink: 0 }}>{children}</div>
        </div>
    );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            role="switch"
            aria-checked={value}
            onClick={() => onChange(!value)}
            style={{
                width: "42px",
                height: "22px",
                borderRadius: "11px",
                background: value ? "var(--emerald)" : "#e5e7eb",
                border: "none",
                cursor: "pointer",
                position: "relative",
                transition: "all 0.2s var(--ease)",
                flexShrink: 0,
                padding: 0
            }}
        >
            <span style={{
                position: "absolute",
                top: "2px",
                left: value ? "22px" : "2px",
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                background: "white",
                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                transition: "left 0.2s var(--ease)",
            }} />
        </button>
    );
}

function SaveButton({ dirty, onSave }: { dirty: boolean; onSave: () => void }) {
    const [saved, setSaved] = useState(false);
    const handle = () => {
        onSave();
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    };
    if (!dirty && !saved) return null;
    return (
        <div style={{
            position: "sticky",
            bottom: "2rem",
            display: "flex",
            justifyContent: "flex-end",
            paddingTop: "1.5rem",
            zIndex: 10
        }}>
            <button
                onClick={handle}
                className="btn btn-primary btn-lg"
                style={{
                    gap: "0.5rem",
                    boxShadow: "var(--shadow-emerald)",
                }}
            >
                {saved ? <><Check size={18} /> 保存しました</> : "変更を保存"}
            </button>
        </div>
    );
}

function SectionCard({ title, description, children, noPadding = false }: {
    title: string;
    description?: string;
    noPadding?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="data-panel" style={{ marginBottom: "1.5rem" }}>
            <div className="panel-header" style={{ padding: "1.25rem 1.75rem" }}>
                <div>
                    <h3 className="panel-title" style={{ fontSize: "1rem" }}>{title}</h3>
                    {description && <p style={{ fontSize: "0.8125rem", color: "var(--text-3)", marginTop: "0.25rem" }}>{description}</p>}
                </div>
            </div>
            <div style={{ padding: noPadding ? "0" : "0 1.75rem 0.5rem" }}>{children}</div>
        </div>
    );
}

// ─── Tab Panels ───────────────────────────────────────

function AccountTab({ me, onSave }: { me: MeData; onSave: (updates: Partial<MeData>) => Promise<void> }) {
    const [name, setName] = useState(me.displayName || me.email.split('@')[0]);
    const [dirty, setDirty] = useState(false);

    return (
        <div className="animate-in">
            {/* Avatar */}
            <SectionCard title="プロフィール">
                <div style={{ padding: "1.25rem 0", display: "flex", alignItems: "center", gap: "2rem" }}>
                    <div style={{
                        width: 80, height: 80, borderRadius: "50%",
                        background: "linear-gradient(135deg, var(--emerald) 0%, #059669 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.75rem", fontWeight: 800, color: "white", flexShrink: 0,
                        boxShadow: "var(--shadow-md)"
                    }}>
                        {name.charAt(0) || me.email.charAt(0)}
                    </div>
                    <div>
                        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.5rem" }}>
                            <button className="btn btn-muted btn-sm">
                                <Camera size={14} /> 画像を変更
                            </button>
                            <button className="btn btn-danger-ghost btn-xs">削除</button>
                        </div>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-4)" }}>JPG, PNG 最大 2MB。正方形の画像を推奨します。</p>
                    </div>
                </div>
            </SectionCard>

            {/* Basic Info */}
            <SectionCard title="基本情報" description="ダッシュボード上での表示名と連絡先設定です。">
                <SettingRow label="表示名" description="チームメンバーに表示される名前です。">
                    <input
                        value={name}
                        onChange={e => { setName(e.target.value); setDirty(true); }}
                        className="search-input"
                        style={{ paddingLeft: "1rem", width: "240px" }}
                    />
                </SettingRow>
                <SettingRow label="メールアドレス" description="ログインおよび通知に使用されます。">
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <span className="mono" style={{ color: "var(--text-2)" }}>{me.email}</span>
                        <span className="badge badge-ok">認証済み</span>
                    </div>
                </SettingRow>
            </SectionCard>

            <SectionCard title="セキュリティ" description="アカウントのアクセス安全性を管理します。">
                <SettingRow label="パスワード" description="定期的な変更を推奨します。">
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={async () => {
                            try {
                                const { auth } = getFirebaseClient();
                                await sendPasswordResetEmail(auth, me.email);
                                alert("パスワード再設定メールを送信しました。メールボックスをご確認ください。");
                            } catch (e) {
                                alert("再設定メールの送信に失敗しました: " + (e as Error).message);
                            }
                        }}
                    >パスワードを変更</button>
                </SettingRow>
                <SettingRow label="二要素認証 (2FA)" description="セキュリティを大幅に強化します。">
                    <button className="btn btn-ghost btn-sm">無効</button>
                </SettingRow>
            </SectionCard>

            <div style={{ marginTop: "3rem", padding: "1.5rem", borderRadius: "14px", border: "1px dashed var(--danger)", background: "rgba(239,68,68,0.02)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                        <p style={{ fontWeight: 800, fontSize: "1rem", color: "var(--danger)" }}>アカウントの削除</p>
                        <p style={{ fontSize: "0.875rem", color: "var(--text-3)", marginTop: "0.25rem" }}>
                            全データが即座に消去されます。この操作は元に戻せません。
                        </p>
                    </div>
                    <button
                        className="btn btn-danger-ghost"
                        onClick={() => alert("アカウント削除リクエストを受け付けました。カスタマーサポートより3営業日以内にご連絡いたします。")}
                    >削除リクエスト</button>
                </div>
            </div>

            <SaveButton dirty={dirty} onSave={async () => {
                await onSave({ displayName: name });
                setDirty(false);
            }} />
        </div>
    );
}

function WorkspaceTab({ me, onSave }: { me: MeData; onSave: (updates: Partial<MeData>) => Promise<void> }) {
    const [wsName, setWsName] = useState(me.workspaceName || "My Workspace");
    const [dirty, setDirty] = useState(false);
    const members = [
        { name: "田中 太郎", email: "tanaka@agency.co.jp", role: "Owner", avatar: "田" },
        { name: "佐藤 花子", email: "sato@agency.co.jp", role: "Admin", avatar: "佐" },
        { name: "鈴木 一郎", email: "suzuki@agency.co.jp", role: "Member", avatar: "鈴" },
    ] as const;

    return (
        <div className="animate-in">
            <SectionCard title="ワークスペース">
                <SettingRow label="ワークスペース名">
                    <input
                        value={wsName}
                        onChange={e => { setWsName(e.target.value); setDirty(true); }}
                        className="search-input"
                        style={{ paddingLeft: "1rem", width: "240px" }}
                    />
                </SettingRow>
                <SettingRow label="法人名 (請求用)" description="領収書に記載される名称です。">
                    <input
                        placeholder="株式会社 MIHARI"
                        className="search-input"
                        style={{ paddingLeft: "1rem", width: "240px" }}
                    />
                </SettingRow>
            </SectionCard>

            <SectionCard title="メンバー" description={`${members.length} 名が参加中`}>
                <div className="card-list">
                    {members.map((m, i) => (
                        <div key={i} className="list-row" style={{ padding: "1rem 0" }}>
                            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "var(--text-2)", flexShrink: 0 }}>
                                {m.avatar}
                            </div>
                            <div style={{ flex: 1 }}>
                                <p style={{ fontWeight: 700, fontSize: "0.9375rem" }}>{m.name}</p>
                                <p style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>{m.email}</p>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                                <span className={`badge ${m.role === 'Owner' ? 'badge-ok' : 'badge-neutral'}`} style={{ fontSize: "0.625rem" }}>
                                    {m.role}
                                </span>
                                {m.role !== "Owner" && (
                                    <button className="btn btn-ghost btn-xs">権限変更</button>
                                )}
                            </div>
                        </div>
                    ))}
                    <div style={{ marginTop: "1.25rem" }}>
                        <button className="btn btn-primary btn-sm">+ メンバーを招待</button>
                    </div>
                </div>
            </SectionCard>

            <SaveButton dirty={dirty} onSave={async () => {
                await onSave({ workspaceName: wsName });
                setDirty(false);
            }} />
        </div>
    );
}

function MonitoringTab({ me, onSave }: { me: MeData; onSave: (updates: Partial<MeData>) => Promise<void> }) {
    const s = me.settings?.monitoring;
    const [interval, setInterval_] = useState<"5m" | "15m" | "1h" | "6h" | "24h">(s?.interval || "15m");
    const [algo, setAlgo] = useState<"dom" | "text" | "html">(s?.algorithm || "dom");
    const [dirty, setDirty] = useState(false);
    const intervals = [["5m", "5分"], ["15m", "15分"], ["1h", "1時間"], ["6h", "6時間"]] as const;

    return (
        <div className="animate-in">
            <SectionCard title="デフォルト設定" description="新規サイト登録時に適用される初期設定です。">
                <SettingRow label="監視頻度" description="チェックを行う周期のデフォルト値です。">
                    <div className="history-tab-group" style={{
                        background: "rgba(0,0,0,0.03)",
                        padding: "4px",
                        borderRadius: "12px",
                        border: "1px solid var(--border)"
                    }}>
                        {intervals.map(([val, label]) => (
                            <button
                                key={val}
                                onClick={() => { setInterval_(val); setDirty(true); }}
                                className={`history-tab ${interval === val ? "active" : ""}`}
                                style={{
                                    fontSize: "0.75rem",
                                    padding: "0.4rem 1rem",
                                    borderWidth: "2px",
                                    borderRadius: "8px"
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </SettingRow>
                <SettingRow label="検知アルゴリズム" description="効率的な変更検出モードを選択します。">
                    <select
                        value={algo}
                        onChange={e => { setAlgo(e.target.value as "dom" | "text" | "html"); setDirty(true); }}
                        className="history-dropdown"
                        style={{ border: "2px solid var(--border)", padding: "0.5rem 2.5rem 0.5rem 1rem" }}
                    >
                        <option value="html">HTML 差分（推奨）</option>
                        <option value="text">テキストのみ</option>
                        <option value="dom">DOM 構造</option>
                    </select>
                </SettingRow>
            </SectionCard>

            <SectionCard title="クローラー設定" description="高度なアクセス設定を管理します。">
                <SettingRow label="Cookie / Header" description="カスタムヘッダーが必要な場合に設定します。">
                    <button className="btn btn-muted btn-xs">管理画面へ</button>
                </SettingRow>
                <SettingRow label="User-Agent" description="ボット検知回避が必要な場合に変更します。">
                    <span style={{ fontSize: "0.875rem", color: "var(--text-4)" }}>Default (MihariBot/2.0)</span>
                </SettingRow>
            </SectionCard>

            <SaveButton dirty={dirty} onSave={async () => {
                await onSave({
                    settings: {
                        ...me.settings,
                        monitoring: { interval, algorithm: algo }
                    }
                });
                setDirty(false);
            }} />
        </div>
    );
}

function NotificationsTab({ me, onSave }: { me: MeData; onSave: (updates: Partial<MeData>) => Promise<void> }) {
    const s = me.settings?.notifications;
    const [email, setEmail] = useState(s?.emailEnabled ?? true);
    const [slack, setSlack] = useState(s?.slackEnabled ?? false);
    const [webhookUrl, setWebhookUrl] = useState(s?.slackWebhookUrl || "");
    const [notifyOn, setNotifyOn] = useState<"all" | "errors" | "critical">(s?.notifyOn || "all");
    const [dirty, setDirty] = useState(false);

    const toggle = (k: "email" | "slack") => {
        if (k === "email") setEmail(prev => !prev);
        if (k === "slack") setSlack(prev => !prev);
        setDirty(true);
    };

    return (
        <div className="animate-in">
            <SectionCard title="通知チャンネル">
                <SettingRow label="メール通知" description="重要アラートをメールで即時受信します。">
                    <Toggle value={email} onChange={() => toggle("email")} />
                </SettingRow>
                <SettingRow label="Slack 連携" description="指定のチャンネルに通知を送信します。">
                    <Toggle value={slack} onChange={() => toggle("slack")} />
                </SettingRow>
            </SectionCard>

            <SectionCard title="Slack 連携 (Webhook)" description="指定したチャンネルにアラートを投稿します。">
                <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
                    <input
                        placeholder="https://hooks.slack.com/services/..."
                        value={webhookUrl}
                        onChange={(e) => { setWebhookUrl(e.target.value); setDirty(true); }}
                        className="search-input"
                        style={{ flex: 1, paddingLeft: "1rem", background: "white" }}
                    />
                    <button
                        className="btn btn-muted"
                        onClick={async () => {
                            if (!webhookUrl) return alert("Webhook URLを入力してください");
                            try {
                                await fetch(webhookUrl, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ text: "MIHARIからのテスト通知です。" }),
                                    mode: "no-cors"
                                });
                                alert("テスト通知を送信しました");
                            } catch {
                                alert("送信に失敗しました");
                            }
                        }}
                    >テスト送信</button>
                </div>
            </SectionCard>

            <SectionCard title="イベント設定">
                <SettingRow label="通知対象" description="どの重要度のアラートを通知するか設定します。">
                    <select
                        value={notifyOn}
                        onChange={e => { setNotifyOn(e.target.value as "all" | "errors" | "critical"); setDirty(true); }}
                        className="history-dropdown"
                        style={{ border: "2px solid var(--border)", padding: "0.5rem 2.5rem 0.5rem 1rem" }}
                    >
                        <option value="all">すべての変更</option>
                        <option value="errors">エラーとクリティカル</option>
                        <option value="critical">クリティカルのみ</option>
                    </select>
                </SettingRow>
            </SectionCard>

            <SaveButton dirty={dirty} onSave={async () => {
                await onSave({
                    settings: {
                        ...me.settings,
                        notifications: { emailEnabled: email, slackEnabled: slack, notifyOn, slackWebhookUrl: webhookUrl }
                    }
                });
                setDirty(false);
            }} />
        </div>
    );
}

function AITab({ me, onSave }: { me: MeData; onSave: (updates: Partial<MeData>) => Promise<void> }) {
    const s = me.settings?.ai;
    const [auto, setAuto] = useState(s?.autoAnalyze ?? true);
    const [scope, setScope] = useState<"full" | "summary">(s?.scope || "full");
    const [dirty, setDirty] = useState(false);
    const scopes = [["full", "すべて"], ["summary", "要約のみ"]] as const;

    return (
        <div className="animate-in">
            <SectionCard title="AI 解析設定" description="AIによる高度なリスク評価の設定。">
                <SettingRow label="自動解析" description="変更検知時に自動で要約とリスク判定を行います。">
                    <Toggle value={auto} onChange={v => { setAuto(v); setDirty(true); }} />
                </SettingRow>
                <SettingRow label="解析対象" description="重要度に応じたフィルタリング。">
                    <div className="history-tab-group" style={{
                        background: "rgba(0,0,0,0.03)",
                        padding: "4px",
                        borderRadius: "12px",
                        border: "1px solid var(--border)"
                    }}>
                        {scopes.map(([val, label]) => (
                            <button
                                key={val}
                                onClick={() => { setScope(val); setDirty(true); }}
                                className={`history-tab ${scope === val ? "active" : ""}`}
                                style={{
                                    fontSize: "0.75rem",
                                    padding: "0.4rem 1.25rem",
                                    borderWidth: "2px",
                                    borderRadius: "8px"
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </SettingRow>
            </SectionCard>

            <SectionCard title="プロンプト・カスタマイズ">
                <div style={{ padding: "1.25rem 0" }}>
                    <p style={{ fontSize: "0.875rem", color: "var(--text-3)", lineHeight: 1.6 }}>
                        AIエンジンの解析視点を調整できます。現在のプランではデフォルトの「Webセキュリティ・ガバナンス」に最適化されています。
                    </p>
                </div>
            </SectionCard>

            <SaveButton dirty={dirty} onSave={async () => {
                await onSave({
                    settings: {
                        ...me.settings,
                        ai: { autoAnalyze: auto, scope }
                    }
                });
                setDirty(false);
            }} />
        </div>
    );
}

function BillingTab({ me }: { me: MeData }) {
    const sitePct = Math.round((me.sitesUsed / me.sitesMax) * 100);
    const aiPct = Math.round((me.aiUsed / me.aiMax) * 100);
    const [showPlanModal, setShowPlanModal] = useState(false);

    return (
        <div className="animate-in">
            {/* Pip-Boy style Retro Monitor Plan Card */}
            <div style={{
                background: "#080b0c",
                border: "4px solid #1a2a22",
                borderRadius: "1.5rem",
                padding: "2.5rem",
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "2rem",
                alignItems: "center",
                marginBottom: "2rem",
                position: "relative",
                overflow: "hidden",
                boxShadow: "0 0 40px rgba(16,185,129,0.1), inset 0 0 20px rgba(0,0,0,0.5)"
            }}>
                {/* Scanline Effect overlay */}
                <div style={{
                    position: "absolute",
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))",
                    backgroundSize: "100% 4px, 3px 100%",
                    pointerEvents: "none",
                    zIndex: 2,
                    opacity: 0.4
                }}></div>
                {/* Vignette */}
                <div style={{
                    position: "absolute",
                    top: 0, left: 0, right: 0, bottom: 0,
                    boxShadow: "inset 0 0 100px rgba(0,0,0,0.8)",
                    pointerEvents: "none",
                    zIndex: 3
                }}></div>

                <div style={{ position: "relative", zIndex: 4, textShadow: "0 0 8px rgba(16,185,129,0.8)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                        <Crown size={20} style={{ color: "var(--emerald)" }} />
                        <span style={{
                            fontSize: "0.8125rem",
                            fontWeight: 900,
                            textTransform: "uppercase",
                            letterSpacing: "0.2em",
                            color: "var(--emerald)",
                            fontFamily: "monospace"
                        }}>
                            OS_SYSTEM_CHECK // OK
                        </span>
                    </div>
                    <p style={{
                        fontSize: "3rem",
                        fontWeight: 900,
                        letterSpacing: "0.05em",
                        color: "var(--emerald)",
                        lineHeight: 1,
                        fontFamily: "monospace",
                        marginBottom: "0.5rem"
                    }}>
                        {me.plan.toUpperCase()}
                    </p>
                    <p style={{
                        fontSize: "1rem",
                        color: "var(--emerald)",
                        marginTop: "1rem",
                        fontWeight: 700,
                        fontFamily: "monospace",
                        opacity: 0.8
                    }}>
                        {">"} SUBSCRIPTION: ACTIVE<br />
                        {">"} NEXT_BILLING: 2026.04.01
                    </p>
                </div>
                <button
                    className="btn btn-primary"
                    style={{
                        padding: "1rem 2rem",
                        borderRadius: "8px",
                        background: "var(--emerald)",
                        border: "none",
                        color: "black",
                        fontWeight: 900,
                        fontFamily: "monospace",
                        boxShadow: "0 0 15px var(--emerald)",
                        zIndex: 4
                    }}
                    onClick={() => setShowPlanModal(true)}
                >
                    UPGRADE_NOW
                </button>
            </div>

            {/* Usage */}
            <SectionCard title="リソース使用状況" description="現在のプラン枠内の利用量です。">
                <div style={{ padding: "1.25rem 0", display: "flex", flexDirection: "column", gap: "2rem" }}>
                    {[
                        { label: "監視サイト数", used: me.sitesUsed, max: me.sitesMax, pct: sitePct, icon: <Globe size={16} /> },
                        { label: "AI解析リクエスト", used: me.aiUsed, max: me.aiMax, pct: aiPct, icon: <Sparkles size={16} /> },
                    ].map(item => (
                        <div key={item.label}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <span style={{ color: "var(--text-3)" }}>{item.icon}</span>
                                    <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text)" }}>{item.label}</span>
                                </div>
                                <span style={{ fontSize: "0.875rem", color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>
                                    <strong style={{ color: "var(--text)", fontSize: "1rem" }}>{item.used}</strong> / {item.max}
                                </span>
                            </div>
                            <div className="score-bar-track" style={{ height: "8px", background: "#f1f3f5" }}>
                                <div className="score-bar-fill" style={{
                                    width: `${item.pct}%`,
                                    background: item.pct > 85 ? "var(--danger)" : item.pct > 65 ? "var(--warn)" : "var(--emerald)",
                                    borderRadius: "10px"
                                }} />
                            </div>
                        </div>
                    ))}
                </div>
            </SectionCard>

            <SectionCard title="請求履歴">
                <div className="card-list">
                    {[
                        { date: "2026.03.01", desc: "Pro Plan - Monthly", amount: "¥5,980" },
                        { date: "2026.02.01", desc: "Pro Plan - Monthly", amount: "¥5,980" }
                    ].map((h, i) => (
                        <div key={i} className="list-row" style={{ padding: "1rem 0" }}>
                            <div style={{ flex: 1 }}>
                                <p style={{ fontWeight: 700, fontSize: "0.9375rem" }}>{h.desc}</p>
                                <p style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>{h.date}</p>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
                                <span style={{ fontWeight: 700, fontSize: "1rem", fontVariantNumeric: "tabular-nums" }}>{h.amount}</span>
                                <button className="btn btn-ghost btn-xs">領収書</button>
                            </div>
                        </div>
                    ))}
                </div>
            </SectionCard>

            {showPlanModal && (
                <PlanChangeModal
                    currentPlanId={(me.plan as "starter" | "pro" | "business" | "enterprise") ?? "starter"}
                    onClose={() => setShowPlanModal(false)}
                />
            )}
        </div>
    );
}


export function SettingsPage({ me }: { me: MeData | null }) {
    const [activeTab, setActiveTab] = useState<Tab>("account");
    const { apiFetch } = useAuth();

    const handleSave = async (updates: Partial<MeData>) => {
        try {
            await apiFetch('/api/me', {
                method: 'PATCH',
                body: JSON.stringify(updates),
            });
        } catch (e) {
            console.error(e);
            alert("保存に失敗しました");
        }
    };

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: "account", label: "アカウント", icon: <User size={16} /> },
        { id: "workspace", label: "チーム", icon: <Building2 size={16} /> },
        { id: "monitoring", label: "監視", icon: <Shield size={16} /> },
        { id: "notifications", label: "通知", icon: <Bell size={16} /> },
        { id: "ai", label: "AI 解析", icon: <Sparkles size={16} /> },
        { id: "billing", label: "プラン & 支払い", icon: <CreditCard size={16} /> },
    ];

    const demoMe: MeData = me ?? {
        displayName: "田中 太郎",
        email: "tanaka@agency.co.jp",
        plan: "pro",
        sitesUsed: 11,
        sitesMax: 15,
        aiUsed: 42,
        aiMax: 200,
        workspaceName: "Agency Workspace",
        settings: {
            monitoring: { interval: "1h", algorithm: "dom" },
            notifications: { emailEnabled: true, slackEnabled: false, notifyOn: "errors" },
            ai: { autoAnalyze: true, scope: "full" }
        }
    };

    const panelContent: Record<Tab, React.ReactNode> = {
        account: <AccountTab me={demoMe} onSave={handleSave} />,
        workspace: <WorkspaceTab me={demoMe} onSave={handleSave} />,
        monitoring: <MonitoringTab me={demoMe} onSave={handleSave} />,
        notifications: <NotificationsTab me={demoMe} onSave={handleSave} />,
        ai: <AITab me={demoMe} onSave={handleSave} />,
        billing: <BillingTab me={demoMe} />,
    };

    return (
        <div style={{ display: "flex", gap: "2.5rem", alignItems: "flex-start" }}>
            {/* ─ Left Tab Nav ─ */}
            <nav style={{
                width: "220px",
                flexShrink: 0,
                position: "sticky",
                top: "calc(var(--header-h) + 2rem)",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
            }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`history-tab ${activeTab === tab.id ? 'active' : ''}`}
                        style={{
                            width: "100%",
                            padding: "0.75rem 1rem",
                            justifyContent: "flex-start",
                            borderWidth: "2px",
                            borderStyle: "solid",
                            borderColor: activeTab === tab.id ? "var(--emerald)" : "transparent",
                            background: activeTab === tab.id ? "white" : "transparent"
                        }}
                    >
                        <span style={{ color: activeTab === tab.id ? "var(--emerald)" : "var(--text-3)", display: "flex", alignItems: "center" }}>
                            {tab.icon}
                        </span>
                        <span style={{ color: activeTab === tab.id ? "var(--emerald)" : "var(--text-2)", fontWeight: activeTab === tab.id ? 700 : 500 }}>
                            {tab.label}
                        </span>
                    </button>
                ))}
            </nav>

            {/* ─ Content ─ */}
            <div style={{ flex: 1, minWidth: 0, paddingBottom: "4rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.75rem" }}>
                    <div style={{ padding: "0.5rem", borderRadius: "10px", background: "white", border: "1px solid var(--border)", display: "flex" }}>
                        {tabs.find(t => t.id === activeTab)?.icon}
                    </div>
                    <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text)" }}>
                        {tabs.find(t => t.id === activeTab)?.label}設定
                    </h1>
                </div>
                {panelContent[activeTab]}
            </div>
        </div>
    );
}
