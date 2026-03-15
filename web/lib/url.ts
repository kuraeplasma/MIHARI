import dns from "dns/promises";
import ipaddr from "ipaddr.js";

const BLOCKED_IPV4_RANGES = new Set([
  "unspecified",
  "broadcast",
  "multicast",
  "linkLocal",
  "loopback",
  "private",
  "carrierGradeNat",
  "reserved"
]);

const BLOCKED_IPV6_RANGES = new Set([
  "unspecified",
  "linkLocal",
  "multicast",
  "loopback",
  "uniqueLocal",
  "ipv4Mapped",
  "rfc6145",
  "rfc6052",
  "6to4",
  "teredo",
  "reserved"
]);

function isUnsafeIpAddress(value: string): boolean {
  if (!ipaddr.isValid(value)) {
    return true;
  }

  const parsed = ipaddr.parse(value);
  if (parsed.kind() === "ipv4") {
    return BLOCKED_IPV4_RANGES.has(parsed.range());
  }

  if (parsed.kind() === "ipv6") {
    const ipv6 = parsed as ipaddr.IPv6;
    if (ipv6.isIPv4MappedAddress()) {
      const mapped = ipv6.toIPv4Address();
      return BLOCKED_IPV4_RANGES.has(mapped.range());
    }
    return BLOCKED_IPV6_RANGES.has(ipv6.range());
  }

  return true;
}

async function resolveHostAddresses(hostname: string): Promise<string[]> {
  if (ipaddr.isValid(hostname)) {
    return [hostname];
  }

  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  return records.map((entry) => entry.address);
}

export async function validateCrawlUrl(urlString: string): Promise<boolean> {
  try {
    const url = new URL(urlString);

    if (!["http:", "https:"].includes(url.protocol)) {
      return false;
    }

    const hostname = url.hostname.trim().toLowerCase();
    if (!hostname || hostname === "localhost" || hostname.endsWith(".local")) {
      return false;
    }

    const addresses = await resolveHostAddresses(hostname);
    if (addresses.length === 0) {
      return false;
    }

    for (const addr of addresses) {
      if (isUnsafeIpAddress(addr)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("URL is empty");
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP/HTTPS URLs are supported");
  }

  return url.toString();
}

export function parseLineSeparatedUrls(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}


