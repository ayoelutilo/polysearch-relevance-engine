const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "with"
]);

const TRACKING_KEYS = new Set(["fbclid", "gclid", "ref"]);

export function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

export function clamp(value: number, min = 0, max = 1): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

export function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function extractDomain(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "unknown.local";
  }
}

export function normalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = url.pathname.replace(/\/+$/, "") || "/";

    const keep: Array<[string, string]> = [];
    for (const [key, value] of url.searchParams.entries()) {
      if (key.startsWith("utm_")) {
        continue;
      }
      if (TRACKING_KEYS.has(key.toLowerCase())) {
        continue;
      }
      keep.push([key, value]);
    }

    keep.sort(([left], [right]) => left.localeCompare(right));
    const query = keep
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&");

    return `${hostname}${pathname}${query ? `?${query}` : ""}`;
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

export function tokenOverlap(queryTokens: string[], targetTokens: string[]): number {
  if (!queryTokens.length || !targetTokens.length) {
    return 0;
  }

  const querySet = new Set(queryTokens);
  const targetSet = new Set(targetTokens);

  let intersection = 0;
  for (const token of querySet) {
    if (targetSet.has(token)) {
      intersection += 1;
    }
  }

  const union = new Set([...querySet, ...targetSet]).size;
  return union === 0 ? 0 : intersection / union;
}
