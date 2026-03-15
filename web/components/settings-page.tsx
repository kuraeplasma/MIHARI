"use client";

import { useEffect, useRef, useState } from "react";
import {
    User, Building2, Shield, Bell, Sparkles, CreditCard,
    Camera, Check, Copy, Crown, Globe, Loader2, LogOut, MailPlus, Trash2
} from "lucide-react";
import { PlanChangeModal } from "@/components/plan-change-modal";
import { getFirebaseClient } from "@/lib/firebase-client";
import { sendPasswordResetEmail } from "firebase/auth";
import { useAuth } from "@/components/auth-provider";
import { useAppPopup } from "@/components/app-popup-provider";
import { PlanName, UserDoc } from "@/types/domain";

// ─── Types ───────────────────────────────────────────
type Tab = "account" | "workspace" | "monitoring" | "notifications" | "ai" | "billing";

interface MeData {
    displayName?: string;
    email: string;
    plan: PlanName;
    sitesUsed: number;
    sitesMax: number;
    aiUsed: number;
    aiMax: number;
    workspaceName?: string;
    billingCompanyName?: string;
    avatarDataUrl?: string | null;
    settings?: UserDoc["settings"];
    billing?: UserDoc["billing"];
    stripeSubscriptionId?: string | null;
    billingHistory?: BillingHistoryItem[];
}

type BillingStatus = NonNullable<UserDoc["billing"]>["status"];

interface BillingHistoryItem {
    billingId: string;
    billedAt: string;
    description: string;
    amount: number | null;
    currency: "JPY";
    status: "scheduled" | "paid" | "failed";
    receiptUrl: string | null;
}

interface WorkspaceInvite {
    inviteId: string;
    email: string;
    role: "member" | "viewer";
    status: "pending";
    inviteUrl: string;
    createdAt: string;
    updatedAt: string;
}

const DEFAULT_SETTINGS: NonNullable<UserDoc["settings"]> = {
    monitoring: {
        interval: "24h",
        algorithm: "dom",
        sslMonitoringEnabled: true,
        domainMonitoringEnabled: true,
        alertOn30Days: false,
        alertOn7Days: true,
        alertOnExpiry: true,
        customHeaders: "",
        userAgent: "MihariBot/2.0"
    },
    notifications: {
        emailEnabled: true,
        slackEnabled: false,
        slackWebhookUrl: "",
        notifyOn: "errors"
    },
    ai: {
        autoAnalyze: true,
        scope: "full"
    }
};

function mergeSettings(settings: UserDoc["settings"] | undefined): NonNullable<UserDoc["settings"]> {
    return {
        monitoring: {
            ...DEFAULT_SETTINGS.monitoring,
            ...(settings?.monitoring ?? {})
        },
        notifications: {
            ...DEFAULT_SETTINGS.notifications,
            ...(settings?.notifications ?? {})
        },
        ai: {
            ...DEFAULT_SETTINGS.ai,
            ...(settings?.ai ?? {})
        }
    };
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

function SaveButton({ dirty, onSave }: { dirty: boolean; onSave: () => Promise<boolean> }) {
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);

    const handle = async () => {
        if (saving) {
            return;
        }

        setSaving(true);
        try {
            const ok = await onSave();
            if (ok) {
                setSaved(true);
                setTimeout(() => setSaved(false), 2500);
            }
        } finally {
            setSaving(false);
        }
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
                onClick={() => { void handle(); }}
                disabled={saving}
                className="btn btn-primary btn-lg"
                style={{
                    gap: "0.5rem",
                    boxShadow: "var(--shadow-emerald)",
                }}
            >
                {saving ? <><Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> 保存中...</> : saved ? <><Check size={18} /> 保存しました</> : "変更を保存"}
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

function AccountTab({
    me,
    onSave,
    onRequestDeleteAccount,
    onSignOut
}: {
    me: MeData;
    onSave: (updates: Partial<MeData>) => Promise<boolean>;
    onRequestDeleteAccount: () => Promise<"pending" | "already_pending">;
    onSignOut: () => Promise<void>;
}) {
    const [name, setName] = useState(me.displayName || me.email.split("@")[0]);
    const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(me.avatarDataUrl ?? null);
    const [dirty, setDirty] = useState(false);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const [signOutSubmitting, setSignOutSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const { showPopup } = useAppPopup();

    const handleAvatarFile = (file: File | null) => {
        if (!file) return;
        const allowed = ["image/png", "image/jpeg", "image/webp"];
        if (!allowed.includes(file.type)) {
            showPopup("PNG/JPEG/WEBP のみアップロードできます。", { title: "画像形式エラー", tone: "error" });
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            showPopup("画像サイズは 2MB 以下にしてください。", { title: "サイズ超過", tone: "error" });
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result !== "string") {
                showPopup("画像の読み込みに失敗しました。", { title: "画像エラー", tone: "error" });
                return;
            }
            setAvatarDataUrl(reader.result);
            setDirty(true);
        };
        reader.onerror = () => showPopup("画像の読み込みに失敗しました。", { title: "画像エラー", tone: "error" });
        reader.readAsDataURL(file);
    };

    const handleDeleteRequest = async () => {
        setDeleteSubmitting(true);
        try {
            const status = await onRequestDeleteAccount();
            if (status === "already_pending") {
                showPopup("すでに削除リクエストを受け付けています。", { title: "削除リクエスト", tone: "info" });
            } else {
                showPopup("アカウント削除リクエストを受け付けました。", { title: "削除リクエスト", tone: "success" });
            }
        } catch {
            showPopup("削除リクエストの送信に失敗しました。", { title: "エラー", tone: "error" });
        } finally {
            setDeleteSubmitting(false);
        }
    };

    const handleSignOut = async () => {
        setSignOutSubmitting(true);
        try {
            await onSignOut();
        } catch {
            showPopup("ログアウトに失敗しました。", { title: "エラー", tone: "error" });
        } finally {
            setSignOutSubmitting(false);
        }
    };

    return (
        <div className="animate-in">
            <SectionCard title="プロフィール">
                <div style={{ padding: "1.25rem 0", display: "flex", alignItems: "center", gap: "2rem" }}>
                    <div style={{ width: 80, height: 80, borderRadius: "50%", background: avatarDataUrl ? "#f3f6f7" : "linear-gradient(135deg, var(--emerald) 0%, #059669 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.75rem", fontWeight: 800, color: "white", flexShrink: 0, boxShadow: "var(--shadow-md)", overflow: "hidden" }}>
                        {avatarDataUrl ? (
                            <img src={avatarDataUrl} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                            <span>{name.charAt(0) || me.email.charAt(0)}</span>
                        )}
                    </div>
                    <div>
                        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={(event) => { const file = event.target.files?.[0] ?? null; handleAvatarFile(file); event.target.value = ""; }} />
                        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.5rem" }}>
                            <button className="btn btn-muted btn-sm" onClick={() => fileInputRef.current?.click()}><Camera size={14} /> 画像を変更</button>
                            <button className="btn btn-danger-ghost btn-xs" onClick={() => { setAvatarDataUrl(null); setDirty(true); }} disabled={!avatarDataUrl}><Trash2 size={12} /> 削除</button>
                        </div>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-4)" }}>JPG, PNG, WEBP 最大 2MB。正方形の画像を推奨します。</p>
                    </div>
                </div>
            </SectionCard>

            <SectionCard title="基本情報" description="ダッシュボード上での表示名と連絡先設定です。">
                <SettingRow label="表示名" description="チームメンバーに表示される名前です。">
                    <input value={name} onChange={(event) => { setName(event.target.value); setDirty(true); }} className="search-input" style={{ paddingLeft: "1rem", width: "240px" }} />
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
                    <button className="btn btn-ghost btn-sm" onClick={async () => {
                        try {
                            const { auth } = getFirebaseClient();
                            await sendPasswordResetEmail(auth, me.email);
                            showPopup("パスワード再設定メールを送信しました。", { title: "メール送信", tone: "success" });
                        } catch {
                            showPopup("再設定メールの送信に失敗しました。", { title: "エラー", tone: "error" });
                        }
                    }}>パスワードを変更</button>
                </SettingRow>
                <SettingRow label="二要素認証 (2FA)" description="Googleアカウント側の設定から有効化できます。">
                    <button className="btn btn-ghost btn-sm" onClick={() => window.open("https://myaccount.google.com/security", "_blank", "noopener,noreferrer")}>Googleセキュリティを開く</button>
                </SettingRow>
                <SettingRow label="ログインセッション" description="この端末からログアウトします。">
                    <button className="btn btn-danger-ghost btn-sm" onClick={() => { void handleSignOut(); }} disabled={signOutSubmitting}><LogOut size={14} /> {signOutSubmitting ? "ログアウト中..." : "ログアウト"}</button>
                </SettingRow>
            </SectionCard>

            <div style={{ marginTop: "3rem", padding: "1.5rem", borderRadius: "14px", border: "1px dashed var(--danger)", background: "rgba(239,68,68,0.02)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                        <p style={{ fontWeight: 800, fontSize: "1rem", color: "var(--danger)" }}>アカウントの削除</p>
                        <p style={{ fontSize: "0.875rem", color: "var(--text-3)", marginTop: "0.25rem" }}>全データが即座に消去されます。この操作は元に戻せません。</p>
                    </div>
                    <button className="btn btn-danger-ghost" onClick={() => { void handleDeleteRequest(); }} disabled={deleteSubmitting}>{deleteSubmitting ? "送信中..." : "削除リクエスト"}</button>
                </div>
            </div>

            <SaveButton dirty={dirty} onSave={async () => {
                const ok = await onSave({ displayName: name, avatarDataUrl });
                if (ok) setDirty(false);
                return ok;
            }} />
        </div>
    );
}

function WorkspaceTab({ me, onSave }: { me: MeData; onSave: (updates: Partial<MeData>) => Promise<boolean> }) {
    const { apiFetch } = useAuth();
    const { showPopup } = useAppPopup();
    const [wsName, setWsName] = useState(me.workspaceName || "My Workspace");
    const [billingCompanyName, setBillingCompanyName] = useState(me.billingCompanyName || "");
    const [dirty, setDirty] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<"member" | "viewer">("member");
    const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
    const [inviteSubmitting, setInviteSubmitting] = useState(false);
    const [inviteLoading, setInviteLoading] = useState(true);
    const ownerName = me.displayName || me.email.split("@")[0] || "Owner";

    useEffect(() => {
        const loadInvites = async () => {
            setInviteLoading(true);
            try {
                const res = await apiFetch("/api/workspace/invites");
                if (!res.ok) throw new Error("招待一覧の取得に失敗しました。");
                const payload = (await res.json()) as { invites?: WorkspaceInvite[] };
                setInvites(Array.isArray(payload.invites) ? payload.invites : []);
            } catch (error) {
                showPopup(error instanceof Error ? error.message : "招待一覧の取得に失敗しました。", { title: "チーム招待", tone: "error" });
            } finally {
                setInviteLoading(false);
            }
        };
        void loadInvites();
    }, [apiFetch, showPopup]);

    const createInvite = async () => {
        const normalized = inviteEmail.trim();
        if (!normalized) {
            showPopup("招待するメールアドレスを入力してください。", { title: "入力エラー", tone: "error" });
            return;
        }
        setInviteSubmitting(true);
        try {
            const res = await apiFetch("/api/workspace/invites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: normalized, role: inviteRole }) });
            const payload = (await res.json()) as { invite?: WorkspaceInvite; error?: string };
            if (!res.ok || !payload.invite) throw new Error(payload.error || "招待の作成に失敗しました。");
            setInvites((prev) => [payload.invite as WorkspaceInvite, ...prev]);
            setInviteEmail("");
            showPopup("招待リンクを作成しました。", { title: "チーム招待", tone: "success" });
        } catch (error) {
            showPopup(error instanceof Error ? error.message : "招待の作成に失敗しました。", { title: "チーム招待", tone: "error" });
        } finally {
            setInviteSubmitting(false);
        }
    };

    const revokeInvite = async (inviteId: string) => {
        try {
            const res = await apiFetch("/api/workspace/invites/" + inviteId, { method: "DELETE" });
            if (!res.ok) throw new Error("招待の削除に失敗しました。");
            setInvites((prev) => prev.filter((invite) => invite.inviteId !== inviteId));
            showPopup("招待を取り消しました。", { title: "チーム招待", tone: "success" });
        } catch {
            showPopup("招待の削除に失敗しました。", { title: "チーム招待", tone: "error" });
        }
    };

    const copyInviteUrl = async (inviteUrl: string) => {
        try {
            await navigator.clipboard.writeText(inviteUrl);
            showPopup("招待リンクをコピーしました。", { title: "チーム招待", tone: "success" });
        } catch {
            showPopup("招待リンクのコピーに失敗しました。", { title: "チーム招待", tone: "error" });
        }
    };

    return (
        <div className="animate-in">
            <SectionCard title="ワークスペース">
                <SettingRow label="ワークスペース名"><input value={wsName} onChange={(event) => { setWsName(event.target.value); setDirty(true); }} className="search-input" style={{ paddingLeft: "1rem", width: "240px" }} /></SettingRow>
                <SettingRow label="法人名 (請求用)" description="領収書に記載される名称です。"><input value={billingCompanyName} onChange={(event) => { setBillingCompanyName(event.target.value); setDirty(true); }} placeholder="株式会社 MIHARI" className="search-input" style={{ paddingLeft: "1rem", width: "300px" }} /></SettingRow>
            </SectionCard>

            <SectionCard title="メンバー" description={String(1 + invites.length) + " 名が参加中"}>
                <div className="card-list">
                    <div className="list-row" style={{ padding: "1rem 0" }}>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "var(--text-2)", flexShrink: 0 }}>{ownerName.charAt(0)}</div>
                        <div style={{ flex: 1 }}><p style={{ fontWeight: 700, fontSize: "0.9375rem" }}>{ownerName}</p><p style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>{me.email}</p></div>
                        <span className="badge badge-ok" style={{ fontSize: "0.625rem" }}>Owner</span>
                    </div>

                    <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                        <p style={{ fontSize: "0.8125rem", color: "var(--text-3)", marginBottom: "0.75rem" }}>メンバー招待</p>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                            <input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="member@example.com" className="search-input" style={{ paddingLeft: "1rem", minWidth: "260px", flex: "1 1 260px" }} />
                            <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as "member" | "viewer")} className="history-dropdown" style={{ border: "2px solid var(--border)", padding: "0.5rem 2.25rem 0.5rem 0.75rem" }}><option value="member">Member</option><option value="viewer">Viewer</option></select>
                            <button className="btn btn-primary btn-sm" onClick={() => { void createInvite(); }} disabled={inviteSubmitting}><MailPlus size={14} /> {inviteSubmitting ? "作成中..." : "招待を作成"}</button>
                        </div>
                    </div>

                    <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                        <p style={{ fontSize: "0.8125rem", color: "var(--text-3)", marginBottom: "0.75rem" }}>保留中の招待</p>
                        {inviteLoading ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", color: "var(--text-3)" }}><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> 読み込み中...</div>
                        ) : invites.length === 0 ? (
                            <p style={{ fontSize: "0.8125rem", color: "var(--text-4)" }}>保留中の招待はありません。</p>
                        ) : (
                            <div style={{ display: "grid", gap: "0.5rem" }}>
                                {invites.map((invite) => (
                                    <div key={invite.inviteId} style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "0.75rem", display: "grid", gap: "0.35rem" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
                                            <div><p style={{ fontWeight: 700, fontSize: "0.875rem" }}>{invite.email}</p><p style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>Role: {invite.role.toUpperCase()}</p></div>
                                            <div style={{ display: "flex", gap: "0.4rem" }}>
                                                <button className="btn btn-ghost btn-xs" onClick={() => { void copyInviteUrl(invite.inviteUrl); }}><Copy size={12} /> リンクコピー</button>
                                                <button className="btn btn-danger-ghost btn-xs" onClick={() => { void revokeInvite(invite.inviteId); }}><Trash2 size={12} /> 取消</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </SectionCard>

            <SaveButton dirty={dirty} onSave={async () => {
                const ok = await onSave({ workspaceName: wsName, billingCompanyName });
                if (ok) setDirty(false);
                return ok;
            }} />
        </div>
    );
}

function MonitoringTab({ me, onSave }: { me: MeData; onSave: (updates: Partial<MeData>) => Promise<boolean> }) {
    const baseSettings = mergeSettings(me.settings);
    const s = baseSettings.monitoring;
    const [interval, setInterval_] = useState<"5m" | "15m" | "1h" | "6h" | "24h">(s?.interval || "15m");
    const [algorithm, setAlgorithm] = useState<"dom" | "text" | "html">(s?.algorithm || "dom");
    const [sslMonitoringEnabled, setSslMonitoringEnabled] = useState(s?.sslMonitoringEnabled ?? true);
    const [domainMonitoringEnabled, setDomainMonitoringEnabled] = useState(s?.domainMonitoringEnabled ?? true);
    const [alertOn30Days, setAlertOn30Days] = useState(s?.alertOn30Days ?? false);
    const [alertOn7Days, setAlertOn7Days] = useState(s?.alertOn7Days ?? true);
    const [alertOnExpiry, setAlertOnExpiry] = useState(s?.alertOnExpiry ?? true);
    const [customHeaders, setCustomHeaders] = useState(s?.customHeaders ?? "");
    const [userAgent, setUserAgent] = useState(s?.userAgent || "MihariBot/2.0");
    const [dirty, setDirty] = useState(false);

    const intervals = [["5m", "5分"], ["15m", "15分"], ["1h", "1時間"], ["6h", "6時間"], ["24h", "24時間"]] as const;

    return (
        <div className="animate-in">
            <SectionCard title="デフォルト設定" description="新規サイト登録時に適用される初期設定です。">
                <SettingRow label="監視頻度" description="チェックを行う周期のデフォルト値です。"><div className="history-tab-group">{intervals.map(([v,l]) => <button key={v} onClick={() => { setInterval_(v); setDirty(true); }} className={"history-tab " + (interval === v ? "active" : "")} style={{ fontSize: "0.75rem", padding: "0.4rem 1rem" }}>{l}</button>)}</div></SettingRow>
                <SettingRow label="検知アルゴリズム" description="効率的な変更検出モードを選択します。"><select value={algorithm} onChange={(event) => { setAlgorithm(event.target.value as "dom" | "text" | "html"); setDirty(true); }} className="history-dropdown" style={{ border: "2px solid var(--border)", padding: "0.5rem 2.5rem 0.5rem 1rem" }}><option value="html">HTML 差分（推奨）</option><option value="text">テキストのみ</option><option value="dom">DOM 構造</option></select></SettingRow>
            </SectionCard>

            <SectionCard title="SSL・ドメイン期限監視" description="有効期限切れを事前に検知して通知します。">
                <SettingRow label="SSL証明書の監視"><Toggle value={sslMonitoringEnabled} onChange={(v) => { setSslMonitoringEnabled(v); setDirty(true); }} /></SettingRow>
                <SettingRow label="ドメイン有効期限の監視"><Toggle value={domainMonitoringEnabled} onChange={(v) => { setDomainMonitoringEnabled(v); setDirty(true); }} /></SettingRow>
                <div style={{ padding: "0.75rem 0", display: "grid", gap: "0.45rem", fontSize: "0.875rem", color: "var(--text-2)" }}>
                    <label><input type="checkbox" checked={alertOn30Days} onChange={(event) => { setAlertOn30Days(event.target.checked); setDirty(true); }} /> 残り30日前</label>
                    <label><input type="checkbox" checked={alertOn7Days} onChange={(event) => { setAlertOn7Days(event.target.checked); setDirty(true); }} /> 残り7日前（デフォルトON）</label>
                    <label><input type="checkbox" checked={alertOnExpiry} onChange={(event) => { setAlertOnExpiry(event.target.checked); setDirty(true); }} /> 期限切れ当日（デフォルトON）</label>
                </div>
            </SectionCard>

            <SectionCard title="クローラー設定" description="高度なアクセス設定を管理します。">
                <SettingRow label="Cookie / Header" description="必要なヘッダーを1行ずつ入力します (例: Authorization: Bearer xxx)"><textarea value={customHeaders} onChange={(event) => { setCustomHeaders(event.target.value); setDirty(true); }} className="search-input" style={{ width: "360px", minHeight: "92px", padding: "0.75rem 1rem", resize: "vertical", background: "white" }} /></SettingRow>
                <SettingRow label="User-Agent" description="ボット検知回避が必要な場合に変更します。"><input value={userAgent} onChange={(event) => { setUserAgent(event.target.value); setDirty(true); }} className="search-input" style={{ width: "320px", paddingLeft: "1rem", background: "white" }} /></SettingRow>
            </SectionCard>

            <SaveButton dirty={dirty} onSave={async () => {
                const ok = await onSave({ settings: { ...baseSettings, monitoring: { ...baseSettings.monitoring, interval, algorithm, sslMonitoringEnabled, domainMonitoringEnabled, alertOn30Days, alertOn7Days, alertOnExpiry, customHeaders, userAgent } } });
                if (ok) setDirty(false);
                return ok;
            }} />
        </div>
    );
}

function NotificationsTab({ me, onSave }: { me: MeData; onSave: (updates: Partial<MeData>) => Promise<boolean> }) {
    const baseSettings = mergeSettings(me.settings);
    const s = baseSettings.notifications;
    const [emailEnabled, setEmailEnabled] = useState(s?.emailEnabled ?? true);
    const [slackEnabled, setSlackEnabled] = useState(s?.slackEnabled ?? false);
    const [webhookUrl, setWebhookUrl] = useState(s?.slackWebhookUrl || "");
    const [notifyOn, setNotifyOn] = useState<"all" | "errors" | "critical">(s?.notifyOn || "errors");
    const [dirty, setDirty] = useState(false);
    const { apiFetch } = useAuth();
    const { showPopup } = useAppPopup();

    return (
        <div className="animate-in">
            <SectionCard title="通知チャンネル">
                <SettingRow label="メール通知" description="重要アラートをメールで即時受信します。"><Toggle value={emailEnabled} onChange={(v) => { setEmailEnabled(v); setDirty(true); }} /></SettingRow>
                <SettingRow label="Slack 連携" description="指定のチャンネルに通知を送信します。"><Toggle value={slackEnabled} onChange={(v) => { setSlackEnabled(v); setDirty(true); }} /></SettingRow>
            </SectionCard>

            <SectionCard title="Slack 連携 (Webhook)" description="指定したチャンネルにアラートを投稿します。">
                <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap" }}>
                    <input placeholder="https://hooks.slack.com/services/..." value={webhookUrl} onChange={(event) => { setWebhookUrl(event.target.value); setDirty(true); }} className="search-input" style={{ flex: "1 1 320px", paddingLeft: "1rem", background: "white" }} />
                    <button className="btn btn-muted" onClick={async () => {
                        if (!webhookUrl) {
                            showPopup("Webhook URLを入力してください", { title: "入力エラー", tone: "error" });
                            return;
                        }
                        try {
                            const res = await apiFetch("/api/notifications/slack/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ webhookUrl }) });
                            if (!res.ok) {
                                const payload = (await res.json().catch(() => ({}))) as { error?: string };
                                throw new Error(payload.error || "テスト通知に失敗しました");
                            }
                            showPopup("テスト通知を送信しました", { title: "通知設定", tone: "success" });
                        } catch (error) {
                            showPopup(error instanceof Error ? error.message : "送信に失敗しました", { title: "通知設定", tone: "error" });
                        }
                    }}>テスト送信</button>
                </div>
            </SectionCard>

            <SectionCard title="イベント設定">
                <SettingRow label="通知対象" description="どの重要度のアラートを通知するか設定します。"><select value={notifyOn} onChange={(event) => { setNotifyOn(event.target.value as "all" | "errors" | "critical"); setDirty(true); }} className="history-dropdown" style={{ border: "2px solid var(--border)", padding: "0.5rem 2.5rem 0.5rem 1rem" }}><option value="all">すべての変更</option><option value="errors">エラーとクリティカル</option><option value="critical">クリティカルのみ</option></select></SettingRow>
            </SectionCard>

            <SaveButton dirty={dirty} onSave={async () => {
                const ok = await onSave({ settings: { ...baseSettings, notifications: { ...baseSettings.notifications, emailEnabled, slackEnabled, notifyOn, slackWebhookUrl: webhookUrl } } });
                if (ok) setDirty(false);
                return ok;
            }} />
        </div>
    );
}
function AITab({ me, onSave }: { me: MeData; onSave: (updates: Partial<MeData>) => Promise<boolean> }) {
    const baseSettings = mergeSettings(me.settings);
    const s = baseSettings.ai;
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
                    <div className="history-tab-group">
                        {scopes.map(([val, label]) => (
                            <button
                                key={val}
                                onClick={() => { setScope(val); setDirty(true); }}
                                className={`history-tab ${scope === val ? "active" : ""}`}
                                style={{
                                    fontSize: "0.75rem",
                                    padding: "0.4rem 1.25rem",
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
                const ok = await onSave({
                    settings: {
                        ...baseSettings,
                        ai: {
                            ...baseSettings.ai,
                            autoAnalyze: auto,
                            scope
                        }
                    }
                });
                if (ok) {
                    setDirty(false);
                }
                return ok;
            }} />
        </div>
    );
}

function toSafePercent(used: number, max: number): number {
    if (!Number.isFinite(max) || max <= 0) {
        return 0;
    }
    return Math.max(0, Math.min(100, Math.round((used / max) * 100)));
}

function formatYmd(iso: string | null | undefined): string {
    if (!iso) {
        return "未設定";
    }

    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return "未設定";
    }

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}.${mm}.${dd}`;
}

function billingStatusLabel(status: BillingStatus): string {
    if (status === "trialing") return "TRIAL";
    if (status === "past_due") return "PAST_DUE";
    if (status === "canceled") return "CANCELED";
    return "ACTIVE";
}

function billingStatusColor(status: BillingStatus): string {
    if (status === "past_due") return "var(--warn)";
    if (status === "canceled") return "var(--danger)";
    return "var(--emerald)";
}

function formatCurrency(amount: number | null, currency: "JPY"): string {
    if (amount === null) {
        return "-";
    }

    return new Intl.NumberFormat("ja-JP", {
        style: "currency",
        currency,
        maximumFractionDigits: 0
    }).format(amount);
}

function BillingTab({
    me,
    onPlanChanged
}: {
    me: MeData;
    onPlanChanged: () => Promise<void>;
}) {
    const sitePct = toSafePercent(me.sitesUsed, me.sitesMax);
    const aiPct = toSafePercent(me.aiUsed, me.aiMax);
    const [showPlanModal, setShowPlanModal] = useState(false);

    const billingCycle = me.billing?.cycle === "annual" ? "annual" : "monthly";
    const billingStatus = me.billing?.status ?? "active";
    const nextBilling = formatYmd(me.billing?.nextBillingAt ?? null);
    const statusColor = billingStatusColor(billingStatus);
    const history = me.billingHistory ?? [];
    const hasActiveSubscription =
        typeof me.stripeSubscriptionId === "string" && me.stripeSubscriptionId.trim().length > 0;

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
                            fontWeight: 700,
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
                        {">"} SUBSCRIPTION: <span style={{ color: statusColor }}>{billingStatusLabel(billingStatus)}</span><br />
                        {">"} BILLING_CYCLE: {billingCycle === "annual" ? "ANNUAL" : "MONTHLY"}<br />
                        {">"} NEXT_BILLING: {nextBilling}
                    </p>
                </div>
                <button
                    className="btn btn-primary"
                    style={{
                        padding: "1rem 2rem",
                        borderRadius: "8px",
                        background: "var(--emerald)",
                        border: "none",
                        color: "#f8fff9",
                        fontWeight: 900,
                        fontSize: "0.92rem",
                        letterSpacing: "0.04em",
                        fontFamily: "monospace",
                        boxShadow: "0 0 15px var(--emerald)",
                        zIndex: 4
                    }}
                    onClick={() => setShowPlanModal(true)}
                >
                    プラン変更
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
                    {history.length === 0 ? (
                        <div style={{ padding: "1rem 0", fontSize: "0.875rem", color: "var(--text-4)" }}>
                            請求履歴はまだありません。
                        </div>
                    ) : history.map((h) => (
                        <div key={h.billingId} className="list-row" style={{ padding: "1rem 0" }}>
                            <div style={{ flex: 1 }}>
                                <p style={{ fontWeight: 700, fontSize: "0.9375rem" }}>{h.description}</p>
                                <p style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
                                    {formatYmd(h.billedAt)} / {h.status.toUpperCase()}
                                </p>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
                                <span style={{ fontWeight: 700, fontSize: "1rem", fontVariantNumeric: "tabular-nums" }}>
                                    {formatCurrency(h.amount, h.currency)}
                                </span>
                                {h.receiptUrl ? (
                                    <a className="btn btn-ghost btn-xs" href={h.receiptUrl} target="_blank" rel="noreferrer">
                                        領収書
                                    </a>
                                ) : (
                                    <button className="btn btn-ghost btn-xs" disabled>領収書</button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </SectionCard>

            {showPlanModal && (
                <PlanChangeModal
                    currentPlanId={(me.plan as "starter" | "pro" | "business" | "enterprise") ?? "starter"}
                    currentBillingCycle={billingCycle}
                    hasActiveSubscription={hasActiveSubscription}
                    onPlanChanged={() => {
                        void onPlanChanged();
                    }}
                    onClose={() => setShowPlanModal(false)}
                />
            )}
        </div>
    );
}

export function SettingsPage({
    me,
    onProfileRefresh
}: {
    me: MeData | null;
    onProfileRefresh?: () => Promise<void>;
}) {
    const [activeTab, setActiveTab] = useState<Tab>("account");
    const { apiFetch, signOutUser } = useAuth();
    const { showPopup } = useAppPopup();

    const handleSave = async (updates: Partial<MeData>): Promise<boolean> => {
        try {
            const res = await apiFetch("/api/me", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
            });

            if (!res.ok) {
                let message = "保存に失敗しました";
                try {
                    const payload = await res.json() as { error?: string };
                    if (payload.error) {
                        message = payload.error;
                    }
                } catch {
                    // Ignore parse errors.
                }
                throw new Error(message);
            }

            if (onProfileRefresh) {
                await onProfileRefresh();
            }

            return true;
        } catch (e) {
            console.error(e);
            showPopup(e instanceof Error ? e.message : "保存に失敗しました", { title: "保存エラー", tone: "error" });
            return false;
        }
    };

    const handleDeleteRequest = async (): Promise<"pending" | "already_pending"> => {
        const res = await apiFetch("/api/account/delete-request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({})
        });

        if (!res.ok) {
            let message = "削除リクエストの送信に失敗しました";
            try {
                const payload = await res.json() as { error?: string };
                if (payload.error) {
                    message = payload.error;
                }
            } catch {
                // Ignore parse errors.
            }
            throw new Error(message);
        }

        const payload = await res.json() as { status?: "pending" | "already_pending" };
        return payload.status === "already_pending" ? "already_pending" : "pending";
    };

    const handlePlanChanged = async () => {
        if (onProfileRefresh) {
            await onProfileRefresh();
        }
    };

    const handleSignOut = async () => {
        await signOutUser();
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
        displayName: "",
        email: "",
        plan: "starter",
        sitesUsed: 0,
        sitesMax: 3,
        aiUsed: 0,
        aiMax: 30,
        workspaceName: "My Workspace",
        billingCompanyName: "",
        avatarDataUrl: null,
        settings: {
            monitoring: {
                interval: "24h",
                algorithm: "dom",
                sslMonitoringEnabled: true,
                domainMonitoringEnabled: true,
                alertOn30Days: false,
                alertOn7Days: true,
                alertOnExpiry: true,
                customHeaders: "",
                userAgent: "MihariBot/2.0"
            },
            notifications: { emailEnabled: true, slackEnabled: false, slackWebhookUrl: "", notifyOn: "errors" },
            ai: { autoAnalyze: true, scope: "full" }
        },
        billing: {
            cycle: "monthly",
            status: "active",
            nextBillingAt: null
        },
        billingHistory: []
    };

    const panelContent: Record<Tab, React.ReactNode> = {
        account: <AccountTab me={demoMe} onSave={handleSave} onRequestDeleteAccount={handleDeleteRequest} onSignOut={handleSignOut} />,
        workspace: <WorkspaceTab me={demoMe} onSave={handleSave} />,
        monitoring: <MonitoringTab me={demoMe} onSave={handleSave} />,
        notifications: <NotificationsTab me={demoMe} onSave={handleSave} />,
        ai: <AITab me={demoMe} onSave={handleSave} />,
        billing: <BillingTab me={demoMe} onPlanChanged={handlePlanChanged} />,
    };

    return (
        <div style={{ display: "flex", gap: "2.5rem", alignItems: "flex-start" }}>
            {/* ─ Left Tab Nav ─ */}
            <nav className="history-tab-group" style={{
                width: "220px",
                flexShrink: 0,
                position: "sticky",
                top: "calc(var(--header-h) + 2rem)",
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch"
            }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`history-tab ${activeTab === tab.id ? 'active' : ''}`}
                        style={{
                            width: "100%",
                            padding: "0.75rem 1rem",
                            justifyContent: "flex-start"
                        }}
                    >
                        <span style={{ display: "flex", alignItems: "center" }}>
                            {tab.icon}
                        </span>
                        <span style={{ fontWeight: activeTab === tab.id ? 700 : 600 }}>
                            {tab.label}
                        </span>
                    </button>
                ))}
            </nav>

            {/* ─ Content ─ */}
            <div style={{ flex: 1, minWidth: 0, paddingBottom: "4rem" }}>
                {panelContent[activeTab]}
            </div>
        </div>
    );
}







