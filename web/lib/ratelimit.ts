import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

const WINDOW_MS = 10_000;
const MAX_REQUESTS_PER_WINDOW = 20;

type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

interface RateLimiter {
  limit: (key: string) => Promise<RateLimitResult>;
}

class MemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, number[]>();

  async limit(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - WINDOW_MS;
    const timestamps = this.buckets.get(key) ?? [];
    const fresh = timestamps.filter((entry) => entry > windowStart);
    fresh.push(now);
    this.buckets.set(key, fresh);

    const success = fresh.length <= MAX_REQUESTS_PER_WINDOW;
    const oldest = fresh[0] ?? now;
    return {
      success,
      limit: MAX_REQUESTS_PER_WINDOW,
      remaining: Math.max(0, MAX_REQUESTS_PER_WINDOW - fresh.length),
      reset: oldest + WINDOW_MS
    };
  }
}

function createRateLimiter(): RateLimiter {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return new MemoryRateLimiter();
  }

  const redis = new Redis({ url, token });
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(MAX_REQUESTS_PER_WINDOW, "10 s"),
    analytics: true
  });
}

const limiter = createRateLimiter();

function firstForwardedIp(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const first = value.split(",")[0]?.trim();
  return first || null;
}

function requestIp(req: NextRequest): string {
  return (
    firstForwardedIp(req.headers.get("x-forwarded-for")) ??
    req.headers.get("x-real-ip") ??
    "anonymous"
  );
}

export async function enforceRateLimit(
  req: NextRequest,
  scope = "api"
): Promise<NextResponse | null> {
  const key = `${scope}:${requestIp(req)}`;
  const result = await limiter.limit(key);
  if (result.success) {
    return null;
  }

  const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter)
      }
    }
  );
}
