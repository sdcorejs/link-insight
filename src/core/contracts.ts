export interface LinkResource {
  readonly providerId: string;
  readonly resourceType: string;
  readonly canonicalUrl: string;
  readonly tenant: string;
  readonly identifier: string;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface NormalizedLinkContent {
  readonly providerId: string;
  readonly resourceType: string;
  readonly identifier: string;
  readonly title: string;
  readonly body: string;
  readonly attributes: Readonly<Record<string, string>>;
}

export interface AiSummary {
  readonly bullets: readonly [string, string, string];
}
