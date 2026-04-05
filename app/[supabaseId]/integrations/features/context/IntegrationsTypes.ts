import type { StudioWebhookLogItem } from "../services/IIntegrationsService";

export interface IntegrationsState {
  supabaseId: string;
  leadFormUrl: string;
  activeTeamId: string | null;
  studioWebhookConfig: {
    configured: boolean;
    tokenMode: "manual" | "auto" | "none";
    tokenPreview: string | null;
    expiryMode: "hours_24" | "months_6" | "indeterminate";
    expiresAt: string | null;
    isExpired: boolean;
    lastUsedAt: string | null;
    webhookUrl: string;
    webhookUrlTemplate: string;
  } | null;
  studioWebhookTokenMode: "manual" | "auto" | "none";
  studioWebhookManualToken: string;
  studioWebhookExpiryMode: "hours_24" | "months_6" | "indeterminate";
  studioWebhookGeneratedUrl: string;
  integrationsBootstrapLoading: boolean;
  studioWebhookLoading: boolean;
  studioWebhookSaving: boolean;
  studioWebhookLogs: StudioWebhookLogItem[];
  studioWebhookLogsLoading: boolean;
  selectedStudioWebhookLogId: string | null;
  studioWebhookContractJson: string;
}

export interface IntegrationsActions {
  copyLeadFormUrl: () => void;
  loadStudioWebhookConfig: () => Promise<void>;
  loadStudioWebhookLogs: (options?: { force?: boolean }) => Promise<void>;
  setStudioWebhookTokenMode: (mode: "manual" | "auto" | "none") => void;
  setStudioWebhookManualToken: (token: string) => void;
  setStudioWebhookExpiryMode: (mode: "hours_24" | "months_6" | "indeterminate") => void;
  setSelectedStudioWebhookLogId: (logId: string | null) => void;
  saveStudioWebhookConfig: () => void;
  copyStudioWebhookUrl: () => void;
  copyStudioWebhookContract: () => void;
}
