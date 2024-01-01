import { applyDomainDiversity } from "./diversity";
import { deduplicateResults } from "./dedup";
import { RelevanceEngine } from "./orchestrator";
import { scoreCandidate } from "./scoring";
import { RelevanceEngineOptions, ProviderResult, SearchProvider, SearchQuery } from "./types";

export * from "./types";
export * from "./dedup";
export * from "./diversity";
export * from "./providers/inMemoryProvider";
export { RelevanceEngine };

export function createRelevanceEngine(
  providers: SearchProvider[],
  options: RelevanceEngineOptions = {}
): RelevanceEngine {
  return new RelevanceEngine(providers, options);
}

export async function searchWithFallback(
  providers: SearchProvider[],
  query: SearchQuery,
  options: RelevanceEngineOptions = {}
) {
  return createRelevanceEngine(providers, options).search(query);
}

export function rankProviderResults(
  query: SearchQuery,
  providerResults: ProviderResult[],
  limit = query.limit ?? 10,
  diversitySuppressionFactor = 0.75
) {
  const deduped = deduplicateResults(providerResults);
  const scored = deduped.records.map((record) => ({
    record,
    score: scoreCandidate(record, query)
  }));

  const reranked = applyDomainDiversity(scored, limit, diversitySuppressionFactor);
  return {
    ranked: reranked,
    suppressedDuplicates: deduped.suppressed
  };
}
