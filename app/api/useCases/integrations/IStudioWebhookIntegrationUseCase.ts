import { Output } from "@/lib/output";

export type StudioWebhookTokenMode = "manual" | "auto" | "none";
export type StudioWebhookTokenExpiryModeValue = "hours_24" | "months_6" | "indeterminate";

export type StudioWebhookLeadPayload = {
  name: string;
  email?: string;
  phone?: string;
  cnpj?: string;
  ages?: string;
  current_health_plan?: string;
  current_value?: number;
  reference_hospital?: string;
  current_treatment?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

export type UpsertStudioWebhookConfigUseCaseInput = {
  teamId: string;
  updatedByProfileId: string;
  tokenMode: StudioWebhookTokenMode;
  manualToken?: string;
  expiryMode: StudioWebhookTokenExpiryModeValue;
  appUrl: string;
};

export type GetStudioWebhookConfigUseCaseInput = {
  teamId: string;
  appUrl: string;
};

export type ProcessStudioWebhookLeadInput = {
  teamId: string;
  token?: string;
  payload: StudioWebhookLeadPayload;
};

export type StudioWebhookRequestLogResultType = "success" | "error";

export type RegisterStudioWebhookRequestLogUseCaseInput = {
  teamId: string;
  method: string;
  endpoint: string;
  statusCode: number;
  resultType: StudioWebhookRequestLogResultType;
  requestPayload?: unknown;
  responsePayload?: unknown;
  errorMessage?: string | null;
};

export type GetStudioWebhookLogsUseCaseInput = {
  teamId: string;
  limit?: number;
};

export interface IStudioWebhookIntegrationUseCase {
  getConfiguration(input: GetStudioWebhookConfigUseCaseInput): Promise<Output>;
  upsertConfiguration(input: UpsertStudioWebhookConfigUseCaseInput): Promise<Output>;
  processWebhookLead(input: ProcessStudioWebhookLeadInput): Promise<Output>;
  getLatestWebhookLogs(input: GetStudioWebhookLogsUseCaseInput): Promise<Output>;
  registerWebhookRequestLog(input: RegisterStudioWebhookRequestLogUseCaseInput): Promise<void>;
}
