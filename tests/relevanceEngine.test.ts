import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { readFileSync } from "node:fs";

import { createRelevanceEngine, InMemorySearchProvider } from "../src";
import { ProviderDocument } from "../src/types";

interface RankingFixture {
  query: string;
  expectedTopCanonicalIds: string[];
  providers: Array<{
    id: string;
    corpus: ProviderDocument[];
  }>;
}

function loadRankingFixture(): RankingFixture {
  const fixturePath = path.resolve(process.cwd(), "tests/fixtures/ranking-regression.json");
  const source = readFileSync(fixturePath, "utf8");
  return JSON.parse(source) as RankingFixture;
}

test("ranking regression fixture keeps stable ordering", async () => {
  const fixture = loadRankingFixture();
  const providers = fixture.providers.map(
    (provider) =>
      new InMemorySearchProvider({
        id: provider.id,
        corpus: provider.corpus
      })
  );

  const engine = createRelevanceEngine(providers, {
    fallbackMode: "on_error_or_low_recall",
    minimumProviderResults: 4,
    diversitySuppressionFactor: 0.72
  });

  const response = await engine.search({
    text: fixture.query,
    limit: 4,
    intentHints: ["security", "best-practices"],
    now: new Date("2026-03-08T00:00:00Z")
  });

  assert.deepEqual(
    response.results.map((result) => result.canonicalId),
    fixture.expectedTopCanonicalIds
  );

  assert.equal(response.suppressedDuplicates.length, 1);
  assert.ok(response.results.some((result) => result.score.signals.diversityPenalty > 0));
});

test("fallback chain continues after provider failure", async () => {
  const providers = [
    new InMemorySearchProvider({
      id: "unstable-primary",
      corpus: [
        {
          id: "will-not-run",
          title: "Primary source",
          snippet: "This item should be skipped after failure.",
          url: "https://unstable.example.com/post",
          authority: 0.8
        }
      ],
      failOnPattern: /incident/
    }),
    new InMemorySearchProvider({
      id: "fallback-secondary",
      corpus: [
        {
          id: "runbook-1",
          title: "Incident response runbook",
          snippet: "Checklist for on-call escalation and rollback.",
          url: "https://ops.example.com/runbooks/incident-response",
          authority: 0.76,
          tags: ["incident", "response", "runbook"]
        }
      ]
    })
  ];

  const engine = createRelevanceEngine(providers, {
    fallbackMode: "on_error"
  });

  const response = await engine.search({
    text: "incident response runbook",
    limit: 3
  });

  assert.equal(response.results.length, 1);
  assert.equal(response.results[0].providerId, "fallback-secondary");

  assert.equal(response.providers[0].status, "error");
  assert.equal(response.providers[1].status, "success");
});

test("low-recall fallback continues when harvested hits are duplicate-heavy", async () => {
  const providers = [
    new InMemorySearchProvider({
      id: "duplicate-heavy-primary",
      corpus: [
        {
          id: "p1",
          title: "Incident response guide",
          snippet: "Runbook for response workflows.",
          url: "https://ops.example.com/runbook?utm_source=a",
          authority: 0.9,
          tags: ["incident", "response", "runbook"],
        },
        {
          id: "p2",
          title: "Incident response guide",
          snippet: "Runbook for response workflows.",
          url: "https://ops.example.com/runbook?utm_medium=b",
          authority: 0.9,
          tags: ["incident", "response", "runbook"],
        },
        {
          id: "p3",
          title: "Incident response guide",
          snippet: "Runbook for response workflows.",
          url: "https://ops.example.com/runbook?ref=c",
          authority: 0.9,
          tags: ["incident", "response", "runbook"],
        },
        {
          id: "p4",
          title: "Incident response guide",
          snippet: "Runbook for response workflows.",
          url: "https://ops.example.com/runbook?gclid=d",
          authority: 0.9,
          tags: ["incident", "response", "runbook"],
        },
        {
          id: "p5",
          title: "Incident response guide",
          snippet: "Runbook for response workflows.",
          url: "https://ops.example.com/runbook?fbclid=e",
          authority: 0.9,
          tags: ["incident", "response", "runbook"],
        },
      ],
    }),
    new InMemorySearchProvider({
      id: "recall-secondary",
      corpus: [
        {
          id: "s1",
          title: "On-call escalation checklist",
          snippet: "Escalation path and comms strategy during incidents.",
          url: "https://secondary.example.com/escalation-checklist",
          authority: 0.8,
          tags: ["incident", "response"],
        },
        {
          id: "s2",
          title: "Rollback procedure template",
          snippet: "Template to safely rollback production deploys.",
          url: "https://secondary.example.com/rollback-template",
          authority: 0.79,
          tags: ["incident", "runbook"],
        },
      ],
    }),
  ];

  const engine = createRelevanceEngine(providers, {
    fallbackMode: "on_error_or_low_recall",
    minimumProviderResults: 5,
  });

  const response = await engine.search({
    text: "incident response runbook",
    limit: 5,
    now: new Date("2026-03-08T00:00:00Z"),
  });

  assert.equal(response.providers.length, 2);
  assert.equal(response.providers[0].providerId, "duplicate-heavy-primary");
  assert.equal(response.providers[1].providerId, "recall-secondary");
  assert.equal(response.providers[1].status, "success");
  assert.ok(response.results.length >= 2);
});

// Refinement.
