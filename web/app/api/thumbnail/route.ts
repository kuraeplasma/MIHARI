import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { enforceRateLimit } from "@/lib/ratelimit";
import { validateCrawlUrl } from "@/lib/url";

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const MIN_WIDTH = 160;
const MAX_WIDTH = 1920;
const MIN_HEIGHT = 90;
const MAX_HEIGHT = 1080;
const MAX_URL_LENGTH = 2048;
const FETCH_TIMEOUT_MS = 12_000;

const WORDPRESS_PENDING_HASHES = new Set<string>([
  "c9e41c15dcb6a54e1820ba258de542b444ea134fca04644f3fa24d123c23656c",
  "4700a7590f97d4958692239b46c3d6924731491611169254b23d4c2a98946508",
  "54f955c3cb0fa833b775ee0c385a54386f0952b3bd6e881f3a42950d2dbfc74b"
]);

function clampDimension(raw: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  const asInt = Math.round(parsed);
  return Math.min(max, Math.max(min, asInt));
}

function buildMshotsUrl(url: string, width: number, height: number) {
  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=${width}&h=${height}`;
}

function buildLoadingSvg(width: number, height: number) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#041209"/>
      <stop offset="100%" stop-color="#020905"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" fill="none" stroke="rgba(83,214,122,0.35)" stroke-width="2"/>
  <g font-family="'JetBrains Mono', 'Courier New', monospace" text-anchor="middle">
    <text x="50%" y="46%" font-size="${Math.max(14, Math.round(width * 0.020))}" fill="#8ef8ba" letter-spacing="2">MIHARI MONITOR</text>
    <text x="50%" y="56%" font-size="${Math.max(18, Math.round(width * 0.032))}" fill="#d9ffe8" letter-spacing="4" font-weight="700">LOADING PREVIEW</text>
    <text x="50%" y="66%" font-size="${Math.max(12, Math.round(width * 0.015))}" fill="#6bb88c" letter-spacing="3">CAPTURE IN PROGRESS</text>
  </g>
</svg>`;
}

function pendingResponse(width: number, height: number) {
  return new Response(buildLoadingSvg(width, height), {
    status: 202,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function isLoopbackHost(hostname: string) {
  const host = hostname.trim().toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(request, "api:thumbnail:get");
  if (limited) {
    return limited;
  }

  const requestUrl = new URL(request.url);
  const allowLocalBypass =
    process.env.NEXT_PUBLIC_LOCAL_DASHBOARD_BYPASS === "1" && isLoopbackHost(requestUrl.hostname);

  if (!allowLocalBypass) {
    const auth = await requireAuth(request);
    if (auth.error) {
      return auth.error;
    }
  }

  const { searchParams } = requestUrl;
  const rawUrl = (searchParams.get("url") ?? "").trim();

  if (!rawUrl || rawUrl.length > MAX_URL_LENGTH) {
    return Response.json({ error: "Invalid url parameter." }, { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    return Response.json({ error: "Invalid url parameter." }, { status: 400 });
  }

  if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
    return Response.json({ error: "Only http/https URLs are supported." }, { status: 400 });
  }

  const isSafe = await validateCrawlUrl(targetUrl.toString());
  if (!isSafe) {
    return Response.json({ error: "Invalid or unsafe URL." }, { status: 400 });
  }

  const width = clampDimension(searchParams.get("w"), DEFAULT_WIDTH, MIN_WIDTH, MAX_WIDTH);
  const height = clampDimension(searchParams.get("h"), DEFAULT_HEIGHT, MIN_HEIGHT, MAX_HEIGHT);
  const mshotsUrl = buildMshotsUrl(targetUrl.toString(), width, height);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let upstream: Response;
  try {
    upstream = await fetch(mshotsUrl, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "MIHARI-Thumbnail/1.0"
      }
    });
  } catch {
    return pendingResponse(width, height);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!upstream.ok) {
    return pendingResponse(width, height);
  }

  const contentType = (upstream.headers.get("content-type") ?? "").toLowerCase();
  const bytes = Buffer.from(await upstream.arrayBuffer());
  const hash = createHash("sha256").update(bytes).digest("hex");

  if (contentType.includes("image/gif") || WORDPRESS_PENDING_HASHES.has(hash)) {
    return pendingResponse(width, height);
  }

  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": contentType || "image/jpeg",
      "Cache-Control": "public, max-age=180, stale-while-revalidate=600",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
