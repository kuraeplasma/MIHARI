"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getSiteThumbnailProxyUrl } from "@/lib/site-thumbnail";

type ThumbState = "loading" | "ready" | "unavailable";

interface SiteThumbnailImageProps {
  url: string;
  alt: string;
  width?: number;
  height?: number;
}

const QUICK_RETRY_LIMIT = 3;
const QUICK_RETRY_BASE_MS = 700;
const SLOW_RETRY_MS = 3500;
const MAX_TOTAL_RETRIES = 6;
const MAX_RETRY_WINDOW_MS = 18_000;
const FETCH_TIMEOUT_MS = 8_000;
const TRANSPARENT_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

export default function SiteThumbnailImage({
  url,
  alt,
  width = 1280,
  height = 720
}: SiteThumbnailImageProps) {
  const { token } = useAuth();
  const allowLocalDashboardBypass = process.env.NEXT_PUBLIC_LOCAL_DASHBOARD_BYPASS === "1";
  const [thumbState, setThumbState] = useState<ThumbState>("loading");
  const [src, setSrc] = useState<string>(TRANSPARENT_PIXEL);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();

    const cleanupBlobUrl = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };

    const markUnavailable = () => {
      setThumbState("unavailable");
      setSrc(TRANSPARENT_PIXEL);
    };

    const scheduleRetry = (nextAttempt: number) => {
      if (cancelled) {
        return;
      }

      const elapsed = Date.now() - startedAt;
      if (nextAttempt > MAX_TOTAL_RETRIES || elapsed >= MAX_RETRY_WINDOW_MS) {
        markUnavailable();
        return;
      }

      setThumbState("loading");
      const delay = nextAttempt <= QUICK_RETRY_LIMIT ? QUICK_RETRY_BASE_MS * nextAttempt : SLOW_RETRY_MS;
      retryTimer = setTimeout(() => {
        void load(nextAttempt);
      }, delay);
    };

    const load = async (attempt: number) => {
      if (cancelled) {
        return;
      }

      if (!token && !allowLocalDashboardBypass) {
        markUnavailable();
        return;
      }

      let response: Response;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      try {
        const headers: HeadersInit | undefined = token
          ? { Authorization: `Bearer ${token}` }
          : undefined;

        response = await fetch(getSiteThumbnailProxyUrl(url, width, height, attempt), {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
          headers
        });
      } catch {
        clearTimeout(timeoutId);
        scheduleRetry(attempt + 1);
        return;
      }

      clearTimeout(timeoutId);

      if (cancelled) {
        return;
      }

      if (response.status === 202 || response.status === 429 || response.status >= 500) {
        scheduleRetry(attempt + 1);
        return;
      }

      if (!response.ok) {
        markUnavailable();
        return;
      }

      const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
      if (!contentType.startsWith("image/")) {
        markUnavailable();
        return;
      }

      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) {
        markUnavailable();
        return;
      }

      cleanupBlobUrl();
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
      setThumbState("ready");
    };

    setThumbState("loading");
    setSrc(TRANSPARENT_PIXEL);

    if (token || allowLocalDashboardBypass) {
      void load(1);
    } else {
      markUnavailable();
    }

    return () => {
      cancelled = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      cleanupBlobUrl();
    };
  }, [allowLocalDashboardBypass, height, retryNonce, token, url, width]);

  return (
    <span className={`site-thumb-media ${thumbState}`}>
      <img
        className="site-thumb-image"
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          objectFit: "contain",
          objectPosition: "center center",
          background: "rgba(2, 10, 5, 0.82)",
          padding: "4px",
          opacity: thumbState === "ready" ? 1 : 0,
          transition: "opacity 160ms ease"
        }}
      />

      {thumbState !== "ready" ? (
        <span className={`site-thumb-loader ${thumbState === "unavailable" ? "unavailable" : ""}`} aria-hidden="true">
          <span className="site-thumb-loader-kicker">MIHARI MONITOR</span>
          <span className="site-thumb-loader-main">
            {thumbState === "unavailable" ? "PREVIEW UNAVAILABLE" : "LOADING PREVIEW"}
          </span>
          <span className="site-thumb-loader-sub">
            {thumbState === "unavailable" ? "RETRY FROM SITE DETAIL" : "CAPTURE IN PROGRESS"}
          </span>
          {thumbState === "unavailable" ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setRetryNonce((prev) => prev + 1);
              }}
              style={{
                marginTop: "8px",
                border: "1px solid rgba(142, 248, 186, 0.45)",
                background: "rgba(4, 18, 9, 0.68)",
                color: "#8ef8ba",
                fontSize: "0.64rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "0.25rem 0.5rem",
                borderRadius: "999px",
                cursor: "pointer",
                pointerEvents: "auto"
              }}
            >
              Retry
            </button>
          ) : null}
          <span className="site-thumb-loader-dots" />
        </span>
      ) : null}
    </span>
  );
}
