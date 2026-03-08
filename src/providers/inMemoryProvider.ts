import { SearchProvider, ProviderDocument, ProviderResult, SearchQuery } from "../types";
import { clamp, extractDomain, tokenOverlap, tokenize } from "../text";

export interface InMemoryProviderOptions {
  id: string;
  corpus: ProviderDocument[];
  latencyMs?: number;
  failOnPattern?: RegExp;
}

function sleep(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export class InMemorySearchProvider implements SearchProvider {
  readonly id: string;

  private readonly corpus: ProviderDocument[];

  private readonly latencyMs: number;

  private readonly failOnPattern?: RegExp;

  constructor(options: InMemoryProviderOptions) {
    this.id = options.id;
    this.corpus = options.corpus;
    this.latencyMs = options.latencyMs ?? 0;
    this.failOnPattern = options.failOnPattern;
  }

  async search(query: SearchQuery): Promise<ProviderResult[]> {
    if (this.failOnPattern?.test(query.text)) {
      throw new Error(`Provider ${this.id} forced failure for query: ${query.text}`);
    }

    await sleep(this.latencyMs);

    const queryTokens = tokenize(query.text);

    const scored = this.corpus
      .filter((document) => {
        const domain = extractDomain(document.url);
        if (query.blockedDomains?.includes(domain)) {
          return false;
        }
        return true;
      })
      .map((document) => {
        const titleTokens = tokenize(document.title);
        const snippetTokens = tokenize(document.snippet);
        const tagTokens = (document.tags ?? []).flatMap((tag) => tokenize(tag));

        const titleMatch = tokenOverlap(queryTokens, titleTokens);
        const snippetMatch = tokenOverlap(queryTokens, snippetTokens);
        const tagMatch = tokenOverlap(queryTokens, tagTokens);

        let providerScore = clamp(titleMatch * 0.55 + snippetMatch * 0.3 + tagMatch * 0.15);

        const domain = extractDomain(document.url);
        if (query.preferredDomains?.includes(domain)) {
          providerScore = clamp(providerScore + 0.08);
        }

        return {
          providerId: this.id,
          providerScore,
          document,
          provenance: `${this.id}:keyword` as const
        };
      })
      .filter((result) => result.providerScore > 0)
      .sort((left, right) => right.providerScore - left.providerScore);

    return scored;
  }
}

// Refinement.

// Refinement.
