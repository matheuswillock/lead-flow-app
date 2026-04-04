export interface IntegrationsState {
  supabaseId: string;
  leadFormUrl: string;
  activeTeamId: string | null;
  studioWebhookConfig: {
    configured: boolean;
    tokenPreview: string | null;
    expiryMode: "hours_24" | "months_6" | "indeterminate";
    expiresAt: string | null;
    isExpired: boolean;
    lastUsedAt: string | null;
    webhookUrlTemplate: string;
  } | null;
  studioWebhookTokenMode: "manual" | "auto";
  studioWebhookManualToken: string;
  studioWebhookExpiryMode: "hours_24" | "months_6" | "indeterminate";
  studioWebhookGeneratedUrl: string;
  studioWebhookLoading: boolean;
  studioWebhookSaving: boolean;
  studioWebhookContractJson: string;
}

export interface IntegrationsActions {
  copyLeadFormUrl: () => void;
  loadStudioWebhookConfig: () => void;
  setStudioWebhookTokenMode: (mode: "manual" | "auto") => void;
  setStudioWebhookManualToken: (token: string) => void;
  setStudioWebhookExpiryMode: (mode: "hours_24" | "months_6" | "indeterminate") => void;
  saveStudioWebhookConfig: () => void;
  copyStudioWebhookUrl: () => void;
  copyStudioWebhookContract: () => void;
}
