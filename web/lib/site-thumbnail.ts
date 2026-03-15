const MSHOTS_BASE_URL = "https://s.wordpress.com/mshots/v1";
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;

function buildMshotsUrl(url: string, width: number, height: number) {
  return `${MSHOTS_BASE_URL}/${encodeURIComponent(url)}?w=${width}&h=${height}`;
}

export function getSiteThumbnail(url: string, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT) {
  return buildMshotsUrl(url, width, height);
}

export function getSiteThumbnailSrcSet(url: string) {
  const w1 = 640;
  const h1 = 360;
  return `${buildMshotsUrl(url, w1, h1)} 1x, ${buildMshotsUrl(url, DEFAULT_WIDTH, DEFAULT_HEIGHT)} 2x`;
}

export function getSiteThumbnailProxyUrl(url: string, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT, nonce?: number) {
  const params = new URLSearchParams({
    url,
    w: String(width),
    h: String(height)
  });
  if (typeof nonce === "number") {
    params.set("v", String(nonce));
  }
  return `/api/thumbnail?${params.toString()}`;
}

export function getSiteFavicon(url: string) {
  return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(url)}`;
}
