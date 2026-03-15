import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-guard";
import { adminDb } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/ratelimit";
import { amountForPlanCycle, computeNextBillingAt, cycleLabel, planLabel } from "@/lib/billing";
import { billingStatusFromStripe, BillingInput, getStripe, resolvePriceId } from "@/lib/stripe";
import { nowIso } from "@/lib/time";
import { BillingHistoryDoc, PlanName, UserDoc } from "@/types/domain";

export const runtime = "nodejs";

const planChangeSchema = z.object({
  plan: z.enum(["starter", "pro", "business", "enterprise"]),
  cycle: z.enum(["monthly", "annual"]).default("annual")
});

const stripePlanChangeSchema = z
  .object({
    planId: z.enum(["starter", "pro", "business"]).optional(),
    plan: z.enum(["starter", "pro", "business"]).optional(),
    billing: z.enum(["monthly", "annual", "yearly"]).optional(),
    cycle: z.enum(["monthly", "annual", "yearly"]).optional()
  })
  .refine((value) => Boolean(value.planId ?? value.plan), {
    message: "planId is required"
  })
  .refine((value) => Boolean(value.billing ?? value.cycle), {
    message: "billing is required"
  });

function normalizeCycle(input: UserDoc["billing"] | undefined): "monthly" | "annual" {
  return input?.cycle === "annual" ? "annual" : "monthly";
}

function normalizePlan(input: string | undefined): PlanName {
  if (input === "starter" || input === "pro" || input === "business" || input === "enterprise") {
    return input;
  }
  return "starter";
}

function extractStripePayload(input: z.infer<typeof stripePlanChangeSchema>): {
  planId: "starter" | "pro" | "business";
  billing: BillingInput;
} {
  const planId = input.planId ?? input.plan;
  const billing = input.billing ?? input.cycle;

  if (!planId || !billing) {
    throw new Error("Invalid plan change payload");
  }

  return {
    planId,
    billing
  };
}

function toIsoFromUnixSeconds(unixSeconds: number | null | undefined): string | null {
  if (!unixSeconds || !Number.isFinite(unixSeconds)) {
    return null;
  }
  return new Date(unixSeconds * 1000).toISOString();
}

function billingCycleFromSubscription(subscription: Stripe.Subscription): "monthly" | "annual" {
  const interval = subscription.items.data[0]?.price?.recurring?.interval;
  return interval === "year" ? "annual" : "monthly";
}

function nextBillingAtFromSubscription(subscription: Stripe.Subscription): string | null {
  const periodEnds = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => Number.isFinite(value));

  if (periodEnds.length === 0) {
    return toIsoFromUnixSeconds(subscription.billing_cycle_anchor);
  }

  return toIsoFromUnixSeconds(Math.min(...periodEnds));
}

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, "api:billing-plan:post");
  if (limited) {
    return limited;
  }

  const auth = await requireAuth(req);
  if (auth.error) {
    return auth.error;
  }

  try {
    const decoded = auth.user;
    const payload = planChangeSchema.parse(await req.json());

    const userRef = adminDb.collection("users").doc(decoded.uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userSnap.data() as UserDoc;
    const currentPlan = normalizePlan(user.plan);
    const currentCycle = normalizeCycle(user.billing);
    const now = nowIso();

    if (payload.plan === "enterprise") {
      const requestRef = adminDb.collection("planChangeRequests").doc();
      await requestRef.set({
        requestId: requestRef.id,
        userId: decoded.uid,
        email: user.email,
        fromPlan: currentPlan,
        toPlan: "enterprise",
        fromCycle: currentCycle,
        requestedCycle: payload.cycle,
        status: "pending",
        createdAt: now,
        updatedAt: now
      });

      return NextResponse.json({
        ok: true,
        mode: "request",
        requestId: requestRef.id,
        message: "Enterprise inquiry has been submitted."
      });
    }

    const nextBillingAt = computeNextBillingAt(payload.cycle, new Date());
    const nextBilling = {
      cycle: payload.cycle,
      status: "active" as const,
      nextBillingAt,
      updatedAt: now
    };

    const planChanged = currentPlan !== payload.plan;
    const cycleChanged = currentCycle !== payload.cycle;

    if (!planChanged && !cycleChanged) {
      return NextResponse.json({
        ok: true,
        mode: "unchanged",
        plan: currentPlan,
        cycle: currentCycle,
        nextBillingAt: user.billing?.nextBillingAt ?? nextBillingAt
      });
    }

    const batch = adminDb.batch();
    batch.set(
      userRef,
      {
        plan: payload.plan,
        billing: nextBilling
      },
      { merge: true }
    );

    const historyRef = adminDb.collection("billingHistory").doc();
    const amount = amountForPlanCycle(payload.plan, payload.cycle);
    const history: BillingHistoryDoc = {
      billingId: historyRef.id,
      userId: decoded.uid,
      kind: planChanged ? "plan_change" : "cycle_change",
      fromPlan: currentPlan,
      toPlan: payload.plan,
      fromCycle: currentCycle,
      toCycle: payload.cycle,
      amount,
      currency: "JPY",
      description: `${planLabel(payload.plan)} ${cycleLabel(payload.cycle)} plan`,
      status: "scheduled",
      billedAt: now,
      receiptUrl: null
    };
    batch.set(historyRef, history);

    await batch.commit();

    return NextResponse.json({
      ok: true,
      mode: "changed",
      plan: payload.plan,
      cycle: payload.cycle,
      nextBillingAt,
      amount
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message ?? "Invalid request" }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to change plan" },
      { status: 400 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const limited = await enforceRateLimit(req, "api:billing-plan:put");
  if (limited) {
    return limited;
  }

  const auth = await requireAuth(req);
  if (auth.error) {
    return auth.error;
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  try {
    const decoded = auth.user;
    const payload = extractStripePayload(stripePlanChangeSchema.parse(await req.json()));
    const priceId = resolvePriceId(payload.planId, payload.billing);

    if (!priceId) {
      return NextResponse.json(
        { error: "Selected plan price is not configured. Please set STRIPE_PRICE_* env values." },
        { status: 503 }
      );
    }

    const userRef = adminDb.collection("users").doc(decoded.uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userSnap.data() as UserDoc;
    const stripeSubscriptionId =
      typeof user.stripeSubscriptionId === "string" && user.stripeSubscriptionId.length > 0
        ? user.stripeSubscriptionId
        : null;

    if (!stripeSubscriptionId) {
      return NextResponse.json({ error: "No active Stripe subscription" }, { status: 400 });
    }

    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const itemId = subscription.items.data[0]?.id;

    if (!itemId) {
      return NextResponse.json({ error: "Subscription item not found" }, { status: 400 });
    }

    const updatedSubscription = await stripe.subscriptions.update(stripeSubscriptionId, {
      items: [
        {
          id: itemId,
          price: priceId
        }
      ],
      proration_behavior: "create_prorations",
      metadata: {
        ...(subscription.metadata ?? {}),
        userId: decoded.uid,
        planId: payload.planId,
        billingCycle: payload.billing === "monthly" ? "monthly" : "yearly"
      }
    });

    const now = nowIso();
    const currentPlan = normalizePlan(user.plan);
    const currentCycle = normalizeCycle(user.billing);
    const nextCycle = billingCycleFromSubscription(updatedSubscription);
    const nextBillingAt = nextBillingAtFromSubscription(updatedSubscription);
    const trialEndAt = toIsoFromUnixSeconds(updatedSubscription.trial_end);
    const customerId =
      typeof updatedSubscription.customer === "string" ? updatedSubscription.customer : user.stripeCustomerId ?? null;

    const planChanged = currentPlan !== payload.planId;
    const amount = amountForPlanCycle(payload.planId, nextCycle);

    const batch = adminDb.batch();
    batch.set(
      userRef,
      {
        plan: payload.planId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: updatedSubscription.id,
        trialEndAt,
        billing: {
          cycle: nextCycle,
          status: billingStatusFromStripe(updatedSubscription.status),
          nextBillingAt,
          updatedAt: now
        }
      },
      { merge: true }
    );

    const historyRef = adminDb.collection("billingHistory").doc();
    const history: BillingHistoryDoc = {
      billingId: historyRef.id,
      userId: decoded.uid,
      kind: planChanged ? "plan_change" : "cycle_change",
      fromPlan: currentPlan,
      toPlan: payload.planId,
      fromCycle: currentCycle,
      toCycle: nextCycle,
      amount,
      currency: "JPY",
      description: `${planLabel(payload.planId)} ${cycleLabel(nextCycle)} plan`,
      status: "scheduled",
      billedAt: now,
      receiptUrl: null
    };

    batch.set(historyRef, history);
    await batch.commit();

    return NextResponse.json({
      success: true,
      plan: payload.planId,
      cycle: nextCycle,
      billingStatus: billingStatusFromStripe(updatedSubscription.status),
      nextBillingAt,
      amount
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message ?? "Invalid request" }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update Stripe subscription" },
      { status: 400 }
    );
  }
}



