import { PlanName } from "@/types/domain";

export interface PlanConfig {
  name: PlanName;
  maxSites: number;
  intervalMinutes: number;
  formMonitoring: boolean;
  aiAnalysis: boolean;
}

export const PLANS: Record<PlanName, PlanConfig> = {
  free: {
    name: "free",
    maxSites: 1,
    intervalMinutes: 24 * 60,
    formMonitoring: false,
    aiAnalysis: false
  },
  pro: {
    name: "pro",
    maxSites: 10,
    intervalMinutes: 60,
    formMonitoring: true,
    aiAnalysis: true
  },
  agency: {
    name: "agency",
    maxSites: 100,
    intervalMinutes: 10,
    formMonitoring: true,
    aiAnalysis: true
  }
};

export function intervalMinutesForPlan(plan: PlanName): number {
  return PLANS[plan].intervalMinutes;
}
