import { PlanName } from "@/types/domain";

export type BillingCycle = "monthly" | "annual";

export interface PlanPrice {
  monthly: number;
  annual: number;
}

export const PLAN_PRICE_JPY: Record<Exclude<PlanName, "enterprise">, PlanPrice> = {
  starter: { monthly: 1480, annual: 14800 },
  pro: { monthly: 5980, annual: 59800 },
  business: { monthly: 14800, annual: 148000 }
};

export function amountForPlanCycle(plan: PlanName, cycle: BillingCycle): number | null {
  if (plan === "enterprise") {
    return null;
  }
  return PLAN_PRICE_JPY[plan][cycle];
}

export function cycleLabel(cycle: BillingCycle): string {
  return cycle === "annual" ? "Annual" : "Monthly";
}

export function planLabel(plan: PlanName): string {
  if (plan === "starter") return "Starter";
  if (plan === "pro") return "Pro";
  if (plan === "business") return "Business";
  return "Enterprise";
}

export function computeNextBillingAt(cycle: BillingCycle, base = new Date()): string {
  const next = new Date(base);
  if (cycle === "annual") {
    next.setUTCFullYear(next.getUTCFullYear() + 1);
  } else {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next.toISOString();
}
