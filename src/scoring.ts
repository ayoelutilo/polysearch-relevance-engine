import { DedupedRecord } from "./dedup";
import { ExplainableScore, SearchQuery } from "./types";
import { clamp, roundScore, tokenOverlap, tokenize } from "./text";

const WEIGHTS = {
  lexical: 0.4,
  freshness: 0.15,
  authority: 0.15,
  intent: 0.1,
  provider: 0.15,
  corroboration: 0.05
} as const;

function scoreFreshness(publishedAt: string | undefined, now: Date): number {
  if (!publishedAt) {
    return 0.55;
  }

  const published = new Date(publishedAt);
  if (Number.isNaN(published.getTime())) {
    return 0.4;
  }

  const ageMs = Math.max(0, now.getTime() - published.getTime());
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays <= 2) {
    return 1;
  }
  if (ageDays <= 7) {
    return 0.9;
  }
  if (ageDays <= 30) {
    return 0.75;
  }
  if (ageDays <= 180) {
    return 0.5;
  }
  return 0.25;
}

function scoreIntent(query: SearchQuery, record: DedupedRecord): number {
  const hints = (query.intentHints ?? []).map((hint) => hint.toLowerCase());
  const tags = (record.representative.document.tags ?? []).map((tag) => tag.toLowerCase());

  if (!hints.length || !tags.length) {
    return 0.5;
  }

  const overlaps = hints.filter((hint) => tags.some((tag) => tag.includes(hint))).length;
  return clamp(overlaps / hints.length);
}

function scoreLexical(query: SearchQuery, record: DedupedRecord): number {
  const queryTokens = tokenize(query.text);
  const titleTokens = tokenize(record.representative.document.title);
  const snippetTokens = tokenize(record.representative.document.snippet);

  const titleOverlap = tokenOverlap(queryTokens, titleTokens);
  const snippetOverlap = tokenOverlap(queryTokens, snippetTokens);

  return clamp(titleOverlap * 0.65 + snippetOverlap * 0.35);
}

export function scoreCandidate(record: DedupedRecord, query: SearchQuery): ExplainableScore {
  const now = query.now ?? new Date();
  const lexical = scoreLexical(query, record);
  const freshness = scoreFreshness(record.representative.document.publishedAt, now);
  const authority = clamp(record.representative.document.authority ?? 0.5);
  const intent = scoreIntent(query, record);
  const provider = clamp(record.representative.providerScore);
  const corroboration = clamp(record.duplicates.length * 0.35);

  const base =
    lexical * WEIGHTS.lexical +
    freshness * WEIGHTS.freshness +
    authority * WEIGHTS.authority +
    intent * WEIGHTS.intent +
    provider * WEIGHTS.provider +
    corroboration * WEIGHTS.corroboration;

  const reasons = [
    `Lexical overlap ${(lexical * 100).toFixed(0)}%.`,
    `Freshness signal ${(freshness * 100).toFixed(0)}%.`,
    `Authority score ${(authority * 100).toFixed(0)}%.`,
    `Provider confidence ${(provider * 100).toFixed(0)}%.`
  ];

  if (record.duplicates.length > 0) {
    reasons.push(`Corroborated by ${record.duplicates.length + 1} provider hits.`);
  }

  return {
    base: roundScore(base),
    total: roundScore(base),
    signals: {
      lexical: roundScore(lexical),
      freshness: roundScore(freshness),
      authority: roundScore(authority),
      intent: roundScore(intent),
      provider: roundScore(provider),
      corroboration: roundScore(corroboration),
      diversityPenalty: 0
    },
    reasons
  };
}

// Refinement.
