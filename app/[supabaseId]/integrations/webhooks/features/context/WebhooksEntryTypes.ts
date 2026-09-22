export interface WebhookDirectionSummary {
  total: number;
  active: number;
  paused: number;
}

export interface WebhooksEntryState {
  supabaseId: string;
  inboundSummary: WebhookDirectionSummary;
  outboundSummary: WebhookDirectionSummary;
  loading: boolean;
  /** true quando a chamada falhou (ex.: 403 para quem não é manager) — não confundir com "zero webhooks". */
  error: boolean;
}

export interface WebhooksEntryActions {
  reload: () => Promise<void>;
}
