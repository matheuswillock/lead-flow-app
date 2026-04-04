export interface BuildLeadFormUrlParams {
  appUrl: string;
  teamId: string;
}

export interface BuildStudioWebhookUrlParams {
  appUrl: string;
  teamId: string;
  token: string;
}

export type StudioWebhookConfigResponse = {
  configured: boolean;
  tokenPreview: string | null;
  expiryMode: "hours_24" | "months_6" | "indeterminate";
  expiresAt: string | null;
  isExpired: boolean;
  lastUsedAt: string | null;
  webhookUrlTemplate: string;
};

export type SaveStudioWebhookConfigPayload = {
  teamId: string;
  tokenMode: "manual" | "auto";
  manualToken?: string;
  expiryMode: "hours_24" | "months_6" | "indeterminate";
};

export type SaveStudioWebhookConfigResponse = StudioWebhookConfigResponse & {
  token: string;
  webhookUrl: string;
};

export interface IIntegrationsService {
  resolveAppUrl(): string;
  buildLeadFormUrl(params: BuildLeadFormUrlParams): string;
  buildStudioWebhookUrl(params: BuildStudioWebhookUrlParams): string;
  copyToClipboard(value: string): Promise<boolean>;
  getStudioWebhookConfig(supabaseId: string, teamId: string): Promise<StudioWebhookConfigResponse>;
  saveStudioWebhookConfig(
    supabaseId: string,
    payload: SaveStudioWebhookConfigPayload
  ): Promise<SaveStudioWebhookConfigResponse>;
}
