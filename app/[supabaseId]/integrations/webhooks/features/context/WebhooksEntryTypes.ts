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
}

export interface WebhooksEntryActions {
  reload: () => Promise<void>;
}
