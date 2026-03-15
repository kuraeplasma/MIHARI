import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-guard";
import { adminDb } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/ratelimit";
import { BillingInput, getStripe, normalizeStripeBillingCycle, resolvePriceId } from "@/lib/stripe";
import { UserDoc } from "@/types/domain";

export const runtime = "nodejs";

const checkoutSchema = z.object({
  planId: z.enum(["starter", "pro", "business"]),
  billing: z.enum(["monthly", "annual", "yearly"]).default("monthly")
});

function resolveAppUrl(request: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }

  const fromOrigin = request.headers.get("origin") ?? request.nextUrl.origin;
  return fromOrigin.replace(/\/$/, "");
}

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, "api:billing-checkout:post");
  if (limited) {
    return limited;
  }

  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  try {
    const payload = checkoutSchema.parse(await request.json());
    const billing = payload.billing as BillingInput;
    const priceId = resolvePriceId(payload.planId, billing);

    if (!priceId) {
      return NextResponse.json(
        { error: "Selected plan price is not configured. Please set STRIPE_PRICE_* env values." },
        { status: 503 }
      );
    }

    const decoded = auth.user;
    const userRef = adminDb.collection("users").doc(decoded.uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userSnap.data() as UserDoc;
    let customerId =
      typeof userData.stripeCustomerId === "string" && userData.stripeCustomerId.length > 0
        ? userData.stripeCustomerId
        : null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: decoded.email ?? userData.email,
        metadata: {
          userId: decoded.uid,
          firebaseUid: decoded.uid
        }
      });

      customerId = customer.id;

      await userRef.set(
        {
          stripeCustomerId: customerId
        },
        { merge: true }
      );
    } else {
      await stripe.customers.update(customerId, {
        metadata: {
          userId: decoded.uid,
          firebaseUid: decoded.uid
        }
      });
    }

    const normalizedBilling = normalizeStripeBillingCycle(billing);
    const appUrl = resolveAppUrl(request);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: decoded.uid,
      locale: "ja",
      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url: `${appUrl}/dashboard/settings?checkout=cancelled`,
      metadata: {
        userId: decoded.uid,
        planId: payload.planId,
        billingCycle: normalizedBilling
      },
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          userId: decoded.uid,
          planId: payload.planId,
          billingCycle: normalizedBilling
        }
      }
    });

    if (!session.url) {
      return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message ?? "Invalid request" }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create checkout session" },
      { status: 400 }
    );
  }
}
