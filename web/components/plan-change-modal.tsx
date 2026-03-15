"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  X,
  Check,
  ChevronRight,
  Zap,
  Building2,
  Star,
  MessageSquare,
  ArrowUp,
  ArrowDown,
  Minus
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";

type PlanId = "starter" | "pro" | "business" | "enterprise";
type BillingCycle = "monthly" | "annual";

interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: string;
  priceAnnualMonthly: string;
  priceAnnualTotal: string;
  priceAnnualDiscount: string;
  sites: string;
  crawl: string;
  ai: string;
  model: string;
  icon: ReactNode;
  highlight?: boolean;
  features: string[];
}

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    priceMonthly: "¥1,480",
    priceAnnualMonthly: "¥1,233",
    priceAnnualTotal: "¥14,800",
    priceAnnualDiscount: "¥2,960",
    sites: "3件",
    crawl: "1分ごと",
    ai: "30回/月",
    model: "標準解析",
    icon: <Zap size={18} />,
    features: ["監視サイト 3件", "クロール間隔 1分", "標準解析 30回/月", "メール通知"]
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: "¥5,980",
    priceAnnualMonthly: "¥4,983",
    priceAnnualTotal: "¥59,800",
    priceAnnualDiscount: "¥11,960",
    sites: "15件",
    crawl: "1分ごと",
    ai: "200回/月",
    model: "標準 / 高精度",
    icon: <Star size={18} />,
    highlight: true,
    features: [
      "監視サイト 15件",
      "クロール間隔 1分",
      "標準 / 高精度解析 200回/月",
      "メール / Slack通知",
      "レポートエクスポート"
    ]
  },
  {
    id: "business",
    name: "Business",
    priceMonthly: "¥14,800",
    priceAnnualMonthly: "¥12,333",
    priceAnnualTotal: "¥148,000",
    priceAnnualDiscount: "¥29,600",
    sites: "40件",
    crawl: "30秒ごと",
    ai: "800回/月",
    model: "標準 / 高精度",
    icon: <Building2 size={18} />,
    features: [
      "監視サイト 40件",
      "クロール間隔 30秒",
      "標準 / 高精度解析 800回/月",
      "メール / Slack / Webhook",
      "レポートエクスポート",
      "優先サポート"
    ]
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceMonthly: "要相談",
    priceAnnualMonthly: "要相談",
    priceAnnualTotal: "要相談",
    priceAnnualDiscount: "ー",
    sites: "無制限",
    crawl: "カスタム",
    ai: "無制限",
    model: "カスタム",
    icon: <MessageSquare size={18} />,
    features: [
      "監視サイト 無制限",
      "クロール間隔 カスタム",
      "AI解析 無制限",
      "モデル・ロジック調整",
      "専任サポート担当",
      "SLA保証",
      "カスタム契約"
    ]
  }
];

const PLAN_ORDER: PlanId[] = ["starter", "pro", "business", "enterprise"];

function getPlan(planId: PlanId): Plan {
  const plan = PLANS.find((item) => item.id === planId);
  if (!plan) {
    throw new Error(`Unknown plan: ${planId}`);
  }
  return plan;
}

function getPlanRank(planId: PlanId): number {
  return PLAN_ORDER.indexOf(planId);
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    if (payload.error) {
      return payload.error;
    }
  } catch {
    // Ignore parse errors and use fallback.
  }

  return fallback;
}

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps = ["プラン選択", "内容確認", "完了"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
      {steps.map((label, index) => {
        const current = index + 1;
        const active = step === current;
        const done = step > current;
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "999px",
                display: "grid",
                placeItems: "center",
                background: done || active ? "var(--emerald)" : "var(--border)",
                color: done || active ? "#fff" : "var(--text-4)",
                fontSize: "0.75rem",
                fontWeight: 700
              }}
            >
              {done ? <Check size={12} /> : current}
            </div>
            <span style={{ fontSize: "0.78rem", color: active ? "var(--text)" : "var(--text-4)", fontWeight: active ? 700 : 500 }}>
              {label}
            </span>
            {current < 3 && <div style={{ flex: 1, height: 1, background: done ? "var(--emerald)" : "var(--border)" }} />}
          </div>
        );
      })}
    </div>
  );
}

function PlanCard({
  plan,
  selected,
  current,
  isAnnual,
  onClick
}: {
  plan: Plan;
  selected: boolean;
  current: boolean;
  isAnnual: boolean;
  onClick: () => void;
}) {
  const isEnterprise = plan.id === "enterprise";
  const price = isAnnual ? plan.priceAnnualTotal : plan.priceMonthly;
  const suffix = isAnnual ? "/年" : "/月";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        borderRadius: "14px",
        border: `1px solid ${selected ? "var(--emerald)" : "var(--border)"}`,
        background: selected ? "rgba(16,185,129,0.06)" : "var(--card-surface)",
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem",
        cursor: "pointer",
        position: "relative"
      }}
    >
      {plan.highlight && (
        <span
          style={{
            position: "absolute",
            top: "-10px",
            right: "10px",
            background: "var(--emerald)",
            color: "#fff",
            borderRadius: "999px",
            fontSize: "0.65rem",
            fontWeight: 800,
            padding: "2px 8px"
          }}
        >
          おすすめ
        </span>
      )}
      {current && (
        <span
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            background: "rgba(16,185,129,0.1)",
            color: "var(--emerald)",
            borderRadius: "999px",
            fontSize: "0.65rem",
            fontWeight: 700,
            padding: "2px 8px"
          }}
        >
          現在
        </span>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ color: "var(--emerald)", display: "inline-flex" }}>{plan.icon}</span>
        <span style={{ fontWeight: 800, fontSize: "1rem" }}>{plan.name}</span>
      </div>
      <div>
        <p style={{ fontSize: isEnterprise ? "1.2rem" : "1.7rem", fontWeight: 800, letterSpacing: "-0.04em" }}>
          {price}
          {!isEnterprise && <span style={{ fontSize: "0.8rem", marginLeft: "0.25rem", color: "var(--text-3)" }}>{suffix}</span>}
        </p>
                {!isEnterprise && (
          <p
            style={{
              fontSize: "0.72rem",
              color: "var(--emerald)",
              fontWeight: 800,
              marginTop: "0.2rem",
              minHeight: "1.05rem",
              visibility: isAnnual ? "visible" : "hidden"
            }}
          >
            月額 {plan.priceAnnualMonthly} 相当 / {plan.priceAnnualDiscount} お得
          </p>
        )}
      </div>
      <div style={{ display: "grid", gap: "0.25rem" }}>
        {[`監視 ${plan.sites}`, `クロール ${plan.crawl}`, `AI ${plan.ai}`, `モデル ${plan.model}`].map((line) => (
          <p key={line} style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
            {line}
          </p>
        ))}
      </div>
    </button>
  );
}

interface PlanChangeModalProps {
  currentPlanId: PlanId;
  currentBillingCycle?: BillingCycle;
  hasActiveSubscription?: boolean;
  onClose: () => void;
  onPlanChanged?: () => void;
}

export function PlanChangeModal({
  currentPlanId,
  currentBillingCycle = "monthly",
  hasActiveSubscription = false,
  onClose,
  onPlanChanged
}: PlanChangeModalProps) {
  const { apiFetch } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>(currentPlanId);
  const [isAnnual, setIsAnnual] = useState(currentBillingCycle === "annual");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedPlanId(currentPlanId);
    setIsAnnual(currentBillingCycle === "annual");
  }, [currentBillingCycle, currentPlanId]);

  useEffect(() => {
    const onEsc = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const currentIsAnnual = currentBillingCycle === "annual";
  const cycle: BillingCycle = isAnnual ? "annual" : "monthly";
  const planChanged = selectedPlanId !== currentPlanId;
  const cycleChanged = selectedPlanId === currentPlanId && isAnnual !== currentIsAnnual;
  const canProceed = hasActiveSubscription ? planChanged || cycleChanged : true;

  const changeType = useMemo(() => {
    if (!planChanged) {
      if (cycleChanged) {
        return "cycle" as const;
      }
      return null;
    }
    return getPlanRank(selectedPlanId) > getPlanRank(currentPlanId) ? "upgrade" : "downgrade";
  }, [cycleChanged, currentPlanId, planChanged, selectedPlanId]);

  const handleConfirm = useCallback(async () => {
    setConfirming(true);
    setError(null);

    try {
      if (selectedPlanId === "enterprise") {
        const res = await apiFetch("/api/billing/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan: selectedPlanId,
            cycle
          })
        });

        if (!res.ok) {
          const message = await readErrorMessage(res, "プラン変更に失敗しました");
          throw new Error(message);
        }

        onPlanChanged?.();
        setStep(3);
        return;
      }

      if (!hasActiveSubscription) {
        const checkoutRes = await apiFetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId: selectedPlanId,
            billing: cycle
          })
        });

        if (!checkoutRes.ok) {
          const message = await readErrorMessage(checkoutRes, "決済ページへの遷移に失敗しました");
          throw new Error(message);
        }

        const payload = (await checkoutRes.json()) as { url?: string; error?: string };
        if (!payload.url) {
          throw new Error(payload.error ?? "決済ページのURLを取得できませんでした");
        }

        window.location.assign(payload.url);
        return;
      }

      const planRes = await apiFetch("/api/billing/plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlanId,
          billing: cycle
        })
      });

      if (!planRes.ok) {
        const message = await readErrorMessage(planRes, "プラン変更に失敗しました");
        throw new Error(message);
      }

      onPlanChanged?.();
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "プラン変更に失敗しました");
    } finally {
      setConfirming(false);
    }
  }, [apiFetch, cycle, hasActiveSubscription, onPlanChanged, selectedPlanId]);

  const selectedPlan = getPlan(selectedPlanId);
  const currentPlan = getPlan(currentPlanId);
  const selectedPrice = isAnnual ? selectedPlan.priceAnnualTotal : selectedPlan.priceMonthly;
  const currentPrice = isAnnual ? currentPlan.priceAnnualTotal : currentPlan.priceMonthly;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(11,16,27,0.7)",
          backdropFilter: "blur(4px)",
          zIndex: 9000
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="プラン変更"
        style={{
          position: "fixed",
          top: "clamp(1rem, 4vh, 2rem)",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9001,
          background: "var(--card-surface)",
          borderRadius: "var(--r-xl)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)",
          width: "min(780px, calc(100vw - 2rem))",
          maxHeight: "calc(100vh - 4rem)",
          overflowY: "auto"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid var(--border)",
            position: "sticky",
            top: 0,
            background: "var(--card-surface)",
            zIndex: 1
          }}
        >
          <h2 style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.01em" }}>
            {step === 1 ? "プラン変更" : step === 2 ? "内容を確認" : "変更完了"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--r-md)",
              display: "inline-grid",
              placeItems: "center",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-3)"
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "1.5rem" }}>
          <StepIndicator step={step} />

          {error && (
            <div
              style={{
                marginBottom: "1rem",
                border: "1px solid rgba(239,68,68,0.35)",
                background: "rgba(239,68,68,0.08)",
                color: "#b91c1c",
                borderRadius: "10px",
                padding: "0.75rem 0.9rem",
                fontSize: "0.8125rem",
                fontWeight: 600
              }}
            >
              {error}
            </div>
          )}

          {step === 1 && (
            <div>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
                <div className="segment-control" style={{ minWidth: "220px", justifyContent: "center" }}>
                  <button
                    type="button"
                    onClick={() => setIsAnnual(false)}
                    className={`segment-item ${!isAnnual ? "active" : ""}`}
                    style={{ padding: "0.55rem 1.2rem", fontSize: "0.85rem", minWidth: "6.5rem", justifyContent: "center" }}
                  >
                    月払い
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAnnual(true)}
                    className={`segment-item ${isAnnual ? "active" : ""}`}
                    style={{ padding: "0.55rem 1.2rem", fontSize: "0.85rem", minWidth: "6.5rem", justifyContent: "center" }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                      年払い
                      <span
                        style={{
                          fontSize: "0.62rem",
                          fontWeight: 800,
                          color: "#065f46",
                          background: "rgba(16,185,129,0.18)",
                          border: "1px solid rgba(16,185,129,0.35)",
                          borderRadius: "999px",
                          padding: "0.1rem 0.4rem",
                          lineHeight: 1.2,
                          whiteSpace: "nowrap"
                        }}
                      >
                        2ヶ月無料
                      </span>
                    </span>
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem", marginBottom: "1.25rem" }}>
                {PLANS.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    selected={plan.id === selectedPlanId}
                    current={plan.id === currentPlanId}
                    isAnnual={isAnnual}
                    onClick={() => setSelectedPlanId(plan.id)}
                  />
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  {changeType === "upgrade" && (
                    <>
                      <ArrowUp size={14} style={{ color: "var(--emerald)" }} />
                      <span style={{ fontSize: "0.8rem", color: "var(--emerald)", fontWeight: 700 }}>アップグレード</span>
                    </>
                  )}
                  {changeType === "downgrade" && (
                    <>
                      <ArrowDown size={14} style={{ color: "var(--warn)" }} />
                      <span style={{ fontSize: "0.8rem", color: "var(--warn)", fontWeight: 700 }}>ダウングレード</span>
                    </>
                  )}
                  {changeType === "cycle" && (
                    <>
                      <Minus size={14} style={{ color: "var(--text-3)" }} />
                      <span style={{ fontSize: "0.8rem", color: "var(--text-3)", fontWeight: 700 }}>請求サイクル変更</span>
                    </>
                  )}
                  {!changeType && hasActiveSubscription && (
                    <>
                      <Minus size={14} style={{ color: "var(--text-4)" }} />
                      <span style={{ fontSize: "0.8rem", color: "var(--text-4)", fontWeight: 600 }}>変更なし</span>
                    </>
                  )}
                  {!hasActiveSubscription && (
                    <>
                      <Minus size={14} style={{ color: "var(--emerald)" }} />
                      <span style={{ fontSize: "0.8rem", color: "var(--emerald)", fontWeight: 700 }}>新規申込</span>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setStep(2)}
                  disabled={!canProceed}
                  style={{ opacity: canProceed ? 1 : 0.4, cursor: canProceed ? "pointer" : "not-allowed" }}
                >
                  続ける <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  background: "var(--card-surface)",
                  padding: "1rem",
                  marginBottom: "1rem"
                }}
              >
                <p style={{ fontSize: "0.75rem", color: "var(--text-4)", fontWeight: 700, marginBottom: "0.5rem" }}>変更内容</p>
                <div style={{ display: "grid", gap: "0.4rem", fontSize: "0.85rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-3)" }}>現在</span>
                    <span style={{ fontWeight: 700 }}>{currentPlan.name} ({currentPrice})</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-3)" }}>変更後</span>
                    <span style={{ fontWeight: 700 }}>{selectedPlan.name} ({selectedPrice})</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-3)" }}>請求サイクル</span>
                    <span style={{ fontWeight: 700 }}>{isAnnual ? "年額" : "月額"}</span>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: "1rem", display: "grid", gap: "0.35rem" }}>
                {selectedPlan.features.map((feature) => (
                  <div key={feature} style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                    <Check size={12} style={{ color: "var(--emerald)", flexShrink: 0 }} />
                    <span style={{ fontSize: "0.8rem", color: "var(--text-2)" }}>{feature}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setStep(1)} disabled={confirming}>
                  戻る
                </button>
                <button type="button" className="btn btn-primary" onClick={() => void handleConfirm()} disabled={confirming}>
                  {confirming ? "処理中..." : selectedPlanId === "enterprise" ? "お問い合わせを送信" : !hasActiveSubscription ? "Stripeで申込へ進む" : "変更を確定"}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ textAlign: "center", padding: "1rem 0" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "999px",
                  display: "grid",
                  placeItems: "center",
                  margin: "0 auto 1rem",
                  background: "rgba(16,185,129,0.12)"
                }}
              >
                <Check size={28} style={{ color: "var(--emerald)" }} />
              </div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "0.4rem" }}>
                {selectedPlanId === "enterprise" ? "お問い合わせを受け付けました" : "プランを変更しました"}
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-3)", marginBottom: "1.2rem" }}>
                {selectedPlanId === "enterprise"
                  ? "担当者よりご連絡いたします。"
                  : `${selectedPlan.name} (${isAnnual ? "年額" : "月額"}) に更新されました。`}
              </p>
              <button type="button" className="btn btn-primary" onClick={onClose}>
                ダッシュボードへ戻る
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}










