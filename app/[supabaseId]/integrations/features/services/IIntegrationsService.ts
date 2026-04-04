export interface BuildLeadFormUrlParams {
  appUrl: string;
  teamId: string;
}

export interface BuildStudioWebhookUrlParams {
  appUrl: string;
  teamId: string;
  token: string;
}

export type StudioWebhookConfigData = {
  configured: boolean;
  tokenMode: "manual" | "auto" | "none";
  tokenPreview: string | null;
  expiryMode: "hours_24" | "months_6" | "indeterminate";
  expiresAt: string | null;
  isExpired: boolean;
  lastUsedAt: string | null;
  webhookUrl: string;
  webhookUrlTemplate: string;
};

export type IntegrationsBootstrapResponse = StudioWebhookConfigData & {
  leadFormUrl: string;
};

export type SaveStudioWebhookConfigPayload = {
  teamId: string;
  tokenMode: "manual" | "auto" | "none";
  manualToken?: string;
  expiryMode: "hours_24" | "months_6" | "indeterminate";
};

export type SaveStudioWebhookConfigResponse = StudioWebhookConfigData & {
  token: string;
  webhookUrl: string;
};

export interface IIntegrationsService {
  resolveAppUrl(): string;
  buildLeadFormUrl(params: BuildLeadFormUrlParams): string;
  buildStudioWebhookUrl(params: BuildStudioWebhookUrlParams): string;
  copyToClipboard(value: string): Promise<boolean>;
  getStudioWebhookConfig(supabaseId: string, teamId: string): Promise<IntegrationsBootstrapResponse>;
  saveStudioWebhookConfig(
    supabaseId: string,
    payload: SaveStudioWebhookConfigPayload
  ): Promise<SaveStudioWebhookConfigResponse>;
}
