import { applyDomainDiversity } from "./diversity";
import { deduplicateResults } from "./dedup";
import { scoreCandidate } from "./scoring";
import {
  ProviderExecution,
  ProviderResult,
  RankedResult,
  RelevanceEngineOptions,
  SearchProvider,
  SearchQuery,
  SearchResponse
} from "./types";

const DEFAULTS: Required<RelevanceEngineOptions> = {
  fallbackMode: "on_error_or_low_recall",
  minimumProviderResults: 5,
  maxProvidersToTry: Number.MAX_SAFE_INTEGER,
  diversitySuppressionFactor: 0.75,
  defaultLimit: 10,
  minProviderScore: 0.08
};

export class RelevanceEngine {
  private readonly providers: SearchProvider[];

  private readonly options: Required<RelevanceEngineOptions>;

  constructor(providers: SearchProvider[], options: RelevanceEngineOptions = {}) {
    this.providers = providers;
    this.options = {
      ...DEFAULTS,
      ...options
    };
  }

  async search(query: SearchQuery): Promise<SearchResponse> {
	    const limit = query.limit ?? this.options.defaultLimit;
	    const providerDiagnostics: ProviderExecution[] = [];
	    const harvested: ProviderResult[] = [];
	    const minimumUniqueResults = Math.max(limit, this.options.minimumProviderResults);

    let providersTried = 0;

    for (const provider of this.providers) {
      if (providersTried >= this.options.maxProvidersToTry) {
        providerDiagnostics.push({
          providerId: provider.id,
          status: "skipped",
          latencyMs: 0,
          resultCount: 0,
          message: "Skipped due to maxProvidersToTry"
        });
        continue;
      }

      providersTried += 1;
      const start = Date.now();

      try {
        const providerResults = await provider.search(query);
        const filtered = providerResults
          .filter((result) => result.providerScore >= this.options.minProviderScore)
          .map((result) => ({ ...result, providerId: provider.id }));

        harvested.push(...filtered);

        providerDiagnostics.push({
          providerId: provider.id,
          status: "success",
          latencyMs: Date.now() - start,
          resultCount: filtered.length
        });

	        if (this.options.fallbackMode === "on_error") {
	          if (filtered.length > 0) {
	            break;
	          }
	        } else {
	          const uniqueCount = deduplicateResults(harvested).records.length;
	          if (uniqueCount >= minimumUniqueResults) {
	            break;
	          }
	        }
	      } catch (error) {
        providerDiagnostics.push({
          providerId: provider.id,
          status: "error",
          latencyMs: Date.now() - start,
          resultCount: 0,
          message: error instanceof Error ? error.message : "Unknown provider failure"
        });
      }
    }

    const deduped = deduplicateResults(harvested);
    const scored = deduped.records.map((record) => ({
      record,
      score: scoreCandidate(record, query)
    }));

    const reranked = applyDomainDiversity(scored, limit, this.options.diversitySuppressionFactor);

    const results: RankedResult[] = reranked.map((entry, index) => ({
      ...entry.record.representative,
      canonicalId: entry.record.canonicalId,
      domain: entry.record.domain,
      duplicateCount: entry.record.duplicates.length,
      score: entry.score,
      rank: index + 1
    }));

    return {
      query: {
        ...query,
        limit
      },
      results,
      providers: providerDiagnostics,
      suppressedDuplicates: deduped.suppressed
    };
  }
}

// Refinement.

// Refinement.
