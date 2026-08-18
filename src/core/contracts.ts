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

export interface JiraSite {
  readonly host: string;
  readonly displayName: string;
}

export interface JiraConnectionStatus {
  readonly connected: boolean;
  readonly reauthorizationRequired: boolean;
  readonly sites: readonly JiraSite[];
}

export interface JiraIssueContext {
  readonly issueKey: string;
  readonly title: string;
  readonly description: string;
  readonly issueType: string;
  readonly status: string;
  readonly priority: string | null;
  readonly assignee: string | null;
  readonly labels: readonly string[];
  readonly comments: readonly string[];
}

export type JiraTransitionFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'single-select'
  | 'multi-select'
  | 'user'
  | 'resolution'
  | 'comment';

export interface JiraTransitionAllowedValue {
  readonly id: string;
  readonly label: string;
}

export interface JiraTransitionField {
  readonly fieldId: string;
  readonly label: string;
  readonly type: JiraTransitionFieldType;
  readonly required: boolean;
  readonly allowedValues?: readonly JiraTransitionAllowedValue[];
  readonly maxLength?: number;
}

export interface JiraTransition {
  readonly id: string;
  readonly name: string;
  readonly toStatus: string;
  readonly fields: readonly JiraTransitionField[];
  readonly unsupportedRequiredFields: readonly string[];
  readonly unsupportedOptionalFields?: readonly string[];
}

export interface JiraTransitionsResult {
  readonly issueKey: string;
  readonly currentStatus: string;
  readonly transitions: readonly JiraTransition[];
}

export type JiraTransitionFieldValue = string | number | readonly string[];

export type JiraTransitionExecuteResult =
  | {
      readonly issueKey: string;
      readonly oldStatus: string;
      readonly newStatus: string;
      readonly applied: true;
    }
  | {
      readonly issueKey: string;
      readonly applied: false;
    };
