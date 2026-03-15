import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { normalizePlanName } from "@/lib/plans";
import { enforceRateLimit } from "@/lib/ratelimit";
import { billingStatusFromStripe, getStripe, planFromPriceId } from "@/lib/stripe";
import { nowIso } from "@/lib/time";
import { PlanName } from "@/types/domain";

export const runtime = "nodejs";

function toIso(unixSeconds: number | null | undefined): string | null {
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
    return toIso(subscription.billing_cycle_anchor);
  }

  return toIso(Math.min(...periodEnds));
}

function resolvePlanFromSubscription(subscription: Stripe.Subscription, planHint?: string): PlanName {
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const rawPlan = planHint ?? subscription.metadata?.planId ?? planFromPriceId(priceId) ?? "starter";
  return normalizePlanName(rawPlan);
}

async function findUserRefByCustomer(customerId: string): Promise<FirebaseFirestore.DocumentReference | null> {
  const snap = await adminDb.collection("users").where("stripeCustomerId", "==", customerId).limit(1).get();
  if (snap.empty) {
    return null;
  }
  return snap.docs[0].ref;
}

async function resolveUidFromCustomerMetadata(stripe: Stripe, customerId: string | null): Promise<string | null> {
  if (!customerId) {
    return null;
  }

  try {
    const customer = await stripe.customers.retrieve(customerId);
    if ("deleted" in customer && customer.deleted) {
      return null;
    }

    const uid = customer.metadata?.userId ?? customer.metadata?.firebaseUid;
    return typeof uid === "string" && uid.length > 0 ? uid : null;
  } catch {
    return null;
  }
}

async function resolveUserRef(
  stripe: Stripe,
  metadataUserId: string | undefined,
  customerId: string | null
): Promise<FirebaseFirestore.DocumentReference | null> {
  if (metadataUserId) {
    return adminDb.collection("users").doc(metadataUserId);
  }

  if (customerId) {
    const byCustomer = await findUserRefByCustomer(customerId);
    if (byCustomer) {
      return byCustomer;
    }
  }

  const uidFromCustomer = await resolveUidFromCustomerMetadata(stripe, customerId);
  if (uidFromCustomer) {
    return adminDb.collection("users").doc(uidFromCustomer);
  }

  return null;
}

async function applySubscriptionUpdate(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  options?: {
    metadataUserId?: string;
    planHint?: string;
    forceCanceled?: boolean;
    forceStarterPlan?: boolean;
  }
) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
  const metadataUserId = options?.metadataUserId ?? subscription.metadata?.userId;
  const userRef = await resolveUserRef(stripe, metadataUserId, customerId);

  if (!userRef) {
    return;
  }

  const billingStatus = options?.forceCanceled ? "canceled" : billingStatusFromStripe(subscription.status);
  const plan = options?.forceStarterPlan ? "starter" : resolvePlanFromSubscription(subscription, options?.planHint);

  await userRef.set(
    {
      plan,
      stripeCustomerId: customerId,
      stripeSubscriptionId: billingStatus === "canceled" ? null : subscription.id,
      trialEndAt: toIso(subscription.trial_end),
      billing: {
        cycle: billingCycleFromSubscription(subscription),
        status: billingStatus,
        nextBillingAt: nextBillingAtFromSubscription(subscription),
        updatedAt: nowIso()
      }
    },
    { merge: true }
  );
}

async function applyPaymentFailure(stripe: Stripe, invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
  const userRef = await resolveUserRef(stripe, invoice.metadata?.userId, customerId);
  if (!userRef) {
    return;
  }

  await userRef.set(
    {
      stripeCustomerId: customerId,
      billing: {
        status: "past_due",
        updatedAt: nowIso()
      }
    },
    { merge: true }
  );
}

async function isProcessed(eventId: string): Promise<boolean> {
  const snap = await adminDb.collection("stripeWebhookEvents").doc(eventId).get();
  return snap.exists;
}

async function markProcessed(event: Stripe.Event) {
  await adminDb.collection("stripeWebhookEvents").doc(event.id).set({
    eventId: event.id,
    type: event.type,
    processedAt: nowIso()
  });
}

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, "api:webhooks-stripe:post");
  if (limited) {
    return limited;
  }

  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
  }

  if (await isProcessed(event.id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await applySubscriptionUpdate(stripe, subscription, {
          metadataUserId: session.metadata?.userId,
          planHint: session.metadata?.planId
        });
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      await applySubscriptionUpdate(stripe, subscription);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await applySubscriptionUpdate(stripe, subscription, {
        forceCanceled: true,
        forceStarterPlan: true
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      await applyPaymentFailure(stripe, invoice);
      break;
    }

    default:
      break;
  }

  await markProcessed(event);
  return NextResponse.json({ received: true });
}

