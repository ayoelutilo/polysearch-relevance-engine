import { DedupedRecord } from "./dedup";
import { ExplainableScore } from "./types";
import { clamp, roundScore } from "./text";

export interface ScoredCandidate {
  record: DedupedRecord;
  score: ExplainableScore;
}

export function applyDomainDiversity(
  candidates: ScoredCandidate[],
  limit: number,
  suppressionFactor: number
): ScoredCandidate[] {
  const safeFactor = clamp(suppressionFactor, 0.4, 1);
  const remaining = candidates.map((candidate) => ({
    record: candidate.record,
    score: {
      ...candidate.score,
      reasons: [...candidate.score.reasons],
      signals: { ...candidate.score.signals }
    }
  }));

  const selected: ScoredCandidate[] = [];
  const domainCounts = new Map<string, number>();

  while (remaining.length > 0 && selected.length < limit) {
    let winnerIndex = 0;
    let winnerAdjustedScore = -1;

    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const alreadySeen = domainCounts.get(candidate.record.domain) ?? 0;
      const multiplier = Math.pow(safeFactor, alreadySeen);
      const adjusted = candidate.score.base * multiplier;

      if (adjusted > winnerAdjustedScore) {
        winnerAdjustedScore = adjusted;
        winnerIndex = index;
      }
    }

    const [winner] = remaining.splice(winnerIndex, 1);
    const alreadySeen = domainCounts.get(winner.record.domain) ?? 0;
    const multiplier = Math.pow(safeFactor, alreadySeen);

    winner.score.total = roundScore(winner.score.base * multiplier);
    winner.score.signals.diversityPenalty = roundScore(1 - multiplier);

    if (alreadySeen > 0) {
      winner.score.reasons.push(
        `Domain diversity suppression applied for repeated domain ${winner.record.domain}.`
      );
    }

    selected.push(winner);
    domainCounts.set(winner.record.domain, alreadySeen + 1);
  }

  return selected;
}

// Refinement.
