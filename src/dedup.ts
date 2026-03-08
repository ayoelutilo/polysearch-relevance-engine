import { ProviderResult, SuppressedDuplicate } from "./types";
import { extractDomain, normalizeUrl } from "./text";

export interface DedupedRecord {
  canonicalId: string;
  domain: string;
  representative: ProviderResult;
  duplicates: ProviderResult[];
}

export interface DeduplicationOutcome {
  records: DedupedRecord[];
  suppressed: SuppressedDuplicate[];
}

function qualitySignal(result: ProviderResult): number {
  const authority = result.document.authority ?? 0.5;
  return result.providerScore * 0.7 + authority * 0.3;
}

export function deduplicateResults(results: ProviderResult[]): DeduplicationOutcome {
  const byCanonical = new Map<string, DedupedRecord>();

  for (const result of results) {
    const canonicalId = normalizeUrl(result.document.url);
    const existing = byCanonical.get(canonicalId);

    if (!existing) {
      byCanonical.set(canonicalId, {
        canonicalId,
        domain: extractDomain(result.document.url),
        representative: result,
        duplicates: []
      });
      continue;
    }

    const shouldReplace = qualitySignal(result) > qualitySignal(existing.representative);
    if (shouldReplace) {
      existing.duplicates.push(existing.representative);
      existing.representative = result;
    } else {
      existing.duplicates.push(result);
    }
  }

  const records = [...byCanonical.values()];
  const suppressed: SuppressedDuplicate[] = records
    .filter((record) => record.duplicates.length > 0)
    .map((record) => ({
      canonicalId: record.canonicalId,
      keptUrl: record.representative.document.url,
      droppedUrls: [...new Set(record.duplicates.map((duplicate) => duplicate.document.url))]
    }));

  return { records, suppressed };
}

// Refinement.

// Refinement.
