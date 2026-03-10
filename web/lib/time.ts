export function nowIso(): string {
  return new Date().toISOString();
}

export function addMinutesIso(minutes: number): string {
  const now = Date.now();
  return new Date(now + minutes * 60_000).toISOString();
}
