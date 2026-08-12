import type { AiSummary, NormalizedLinkContent } from '../core/contracts';

export interface SummarizationCredentials {
  readonly apiKey: string;
}

export interface Summarizer {
  summarize(
    content: NormalizedLinkContent,
    credentials: SummarizationCredentials,
  ): Promise<AiSummary>;
}
