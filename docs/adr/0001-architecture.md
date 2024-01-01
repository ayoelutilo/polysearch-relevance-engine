# ADR 0001: Relevance Pipeline Architecture

## Status

Accepted

## Context

The engine needs to combine multiple search providers while remaining interpretable and deterministic under failure.

## Decision

We use a sequential provider fallback pipeline with three post-retrieval stages:

1. Canonical deduplication: merge equivalent URLs and keep the strongest representative.
2. Explainable scoring: compute weighted signal scores (lexical, freshness, authority, intent, provider confidence, corroboration).
3. Domain diversity suppression: greedily rerank with multiplicative penalties for repeated domains.

Fallback strategy is configurable:

- `on_error`: only consult fallback providers when the previous provider fails or returns empty.
- `on_error_or_low_recall`: continue until enough results are collected.

## Consequences

- Deterministic behavior and reproducible ranking regression tests.
- Clear observability via provider diagnostics and score explanations.
- Slightly lower throughput than parallel fan-out due to sequential fallback.
- Easy extension for future semantic signals and provider adapters.

- Changelog: minor updates.
