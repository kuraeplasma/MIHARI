import Stripe from "stripe";
import { PlanName, UserDoc } from "@/types/domain";

export type PaidPlanName = Exclude<PlanName, "enterprise">;
export type BillingInput = "monthly" | "annual" | "yearly";
export type StripeBillingCycle = "monthly" | "yearly";

type BillingStatus = NonNullable<UserDoc["billing"]>["status"];

const STRIPE_API_VERSION = "2024-06-20" as Stripe.LatestApiVersion;

let cachedStripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    return null;
  }

  if (cachedStripe) {
    return cachedStripe;
  }

  cachedStripe = new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION
  });

  return cachedStripe;
}

export const PRICE_IDS = {
  starter: {
    monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
    yearly: process.env.STRIPE_PRICE_STARTER_YEARLY
  },
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    yearly: process.env.STRIPE_PRICE_PRO_YEARLY
  },
  business: {
    monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
    yearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY
  }
} as const;

export const PLAN_LIMITS = {
  starter: { sites: 3, aiAnalysis: 30 },
  pro: { sites: 15, aiAnalysis: 200 },
  business: { sites: 40, aiAnalysis: 800 },
  enterprise: { sites: Number.POSITIVE_INFINITY, aiAnalysis: Number.POSITIVE_INFINITY }
} as const;

export function normalizeStripeBillingCycle(input: BillingInput): StripeBillingCycle {
  return input === "monthly" ? "monthly" : "yearly";
}

export function toInternalBillingCycle(input: StripeBillingCycle): NonNullable<UserDoc["billing"]>["cycle"] {
  return input === "yearly" ? "annual" : "monthly";
}

export function resolvePriceId(planId: PaidPlanName, billing: BillingInput): string | null {
  const cycle = normalizeStripeBillingCycle(billing);
  const priceId = PRICE_IDS[planId][cycle];
  if (!priceId || priceId.trim().length === 0) {
    return null;
  }
  return priceId;
}

export function planFromPriceId(priceId: string | null | undefined): PaidPlanName | null {
  if (!priceId) {
    return null;
  }

  const entries = Object.entries(PRICE_IDS) as Array<[
    PaidPlanName,
    { monthly: string | undefined; yearly: string | undefined }
  ]>;

  for (const [planId, cycles] of entries) {
    if (cycles.monthly === priceId || cycles.yearly === priceId) {
      return planId;
    }
  }

  return null;
}

export function billingStatusFromStripe(status: Stripe.Subscription.Status): BillingStatus {
  if (status === "trialing") {
    return "trialing";
  }

  if (status === "active") {
    return "active";
  }

  if (status === "past_due" || status === "incomplete" || status === "incomplete_expired" || status === "unpaid") {
    return "past_due";
  }

  return "canceled";
}
