import { PlanName } from "@/types/domain";

export interface PlanConfig {
  name: PlanName;
  maxSites: number;
  intervalMinutes: number;
  formMonitoring: boolean;
  aiAnalysis: boolean;
}

export const PLANS: Record<PlanName, PlanConfig> = {
  starter: {
    name: "starter",
    maxSites: 3,
    intervalMinutes: 1,
    formMonitoring: true,
    aiAnalysis: true
  },
  pro: {
    name: "pro",
    maxSites: 15,
    intervalMinutes: 1,
    formMonitoring: true,
    aiAnalysis: true
  },
  business: {
    name: "business",
    maxSites: 40,
    intervalMinutes: 0.5,
    formMonitoring: true,
    aiAnalysis: true
  },
  enterprise: {
    name: "enterprise",
    maxSites: Number.MAX_SAFE_INTEGER,
    intervalMinutes: 0.5,
    formMonitoring: true,
    aiAnalysis: true
  }
};

export function intervalMinutesForPlan(plan: PlanName): number {
  return PLANS[plan].intervalMinutes;
}

export function normalizePlanName(plan: string | undefined | null): PlanName {
  if (plan === "starter" || plan === "pro" || plan === "business" || plan === "enterprise") {
    return plan;
  }
  if (plan === "free") return "starter";
  if (plan === "agency") return "business";
  return "starter";
}
