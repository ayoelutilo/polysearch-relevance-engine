# polysearch-relevance-engine

A focused TypeScript relevance engine for multi-provider search aggregation with deterministic fallback behavior and transparent scoring.

Status: source-only reference implementation (`package.json` is private).

## What It Does

- Defines a provider abstraction (`SearchProvider`) for pluggable backends.
- Orchestrates provider fallback (`on_error` or `on_error_or_low_recall`).
- Produces explainable scores with per-signal breakdowns.
- Deduplicates canonical URLs across providers and tracks suppressed duplicates.
- Applies domain diversity suppression to reduce host monopolies in top results.

## Quick Start

```bash
cd polysearch-relevance-engine
npm install
npm test
```

## Example

```ts
import {
  createRelevanceEngine,
  InMemorySearchProvider
} from "./src";

const providers = [
  new InMemorySearchProvider({
    id: "docs",
    corpus: [
      {
        id: "1",
        url: "https://example.com/search-ranking",
        title: "Search ranking techniques",
        snippet: "Scoring, deduplication, and diversity in one pipeline.",
        authority: 0.8,
        tags: ["ranking", "search"]
      }
    ]
  })
];

const engine = createRelevanceEngine(providers, {
  fallbackMode: "on_error_or_low_recall",
  minimumProviderResults: 5,
  diversitySuppressionFactor: 0.75
});

const response = await engine.search({
  text: "search ranking",
  limit: 10,
  intentHints: ["ranking"]
});

console.log(response.results[0].score);
```

## API Surface

- `createRelevanceEngine(providers, options)`
- `searchWithFallback(providers, query, options)`
- `rankProviderResults(query, providerResults, limit?, diversitySuppressionFactor?)`
- `InMemorySearchProvider` for local testing and deterministic fixtures

## Project Structure

- `src/orchestrator.ts`: fallback logic and ranking orchestration
- `src/scoring.ts`: explainable scoring model
- `src/dedup.ts`: canonical deduplication across providers
- `src/diversity.ts`: domain diversity suppression
- `tests/relevanceEngine.test.ts`: ranking regression and fallback behavior tests

- Changelog: minor updates.

- Changelog: minor updates.
