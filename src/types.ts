export interface SearchQuery {
  text: string;
  limit?: number;
  now?: Date;
  intentHints?: string[];
  preferredDomains?: string[];
  blockedDomains?: string[];
}

export interface ProviderDocument {
  id: string;
  url: string;
  title: string;
  snippet: string;
  publishedAt?: string;
  authority?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface ProviderResult {
  providerId: string;
  providerScore: number;
  document: ProviderDocument;
  provenance?: string;
}

export interface SearchProvider {
  id: string;
  search(query: SearchQuery): Promise<ProviderResult[]>;
}

export type ProviderStatus = "success" | "error" | "skipped";

export interface ProviderExecution {
  providerId: string;
  status: ProviderStatus;
  latencyMs: number;
  resultCount: number;
  message?: string;
}

export interface ScoreSignals {
  lexical: number;
  freshness: number;
  authority: number;
  intent: number;
  provider: number;
  corroboration: number;
  diversityPenalty: number;
}

export interface ExplainableScore {
  base: number;
  total: number;
  signals: ScoreSignals;
  reasons: string[];
}

export interface RankedResult extends ProviderResult {
  canonicalId: string;
  domain: string;
  duplicateCount: number;
  score: ExplainableScore;
  rank: number;
}

export interface SuppressedDuplicate {
  canonicalId: string;
  keptUrl: string;
  droppedUrls: string[];
}

export interface SearchResponse {
  query: SearchQuery;
  results: RankedResult[];
  providers: ProviderExecution[];
  suppressedDuplicates: SuppressedDuplicate[];
}

export interface RelevanceEngineOptions {
  fallbackMode?: "on_error" | "on_error_or_low_recall";
  minimumProviderResults?: number;
  maxProvidersToTry?: number;
  diversitySuppressionFactor?: number;
  defaultLimit?: number;
  minProviderScore?: number;
}

// Refinement.
