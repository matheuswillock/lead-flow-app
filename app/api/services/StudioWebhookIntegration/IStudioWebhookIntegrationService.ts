import { StudioWebhookTokenExpiryMode } from "@prisma/client";

export type StudioWebhookTeamSnapshot = {
  id: string;
  masterId: string;
  master: {
    id: string;
    supabaseId: string | null;
  };
};

export type StudioWebhookConfigSnapshot = {
  id: string;
  teamId: string;
  tokenHash: string;
  tokenPreview: string;
  expiryMode: StudioWebhookTokenExpiryMode;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  updatedByProfileId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type UpsertStudioWebhookConfigInput = {
  teamId: string;
  tokenHash: string;
  tokenPreview: string;
  expiryMode: StudioWebhookTokenExpiryMode;
  expiresAt: Date | null;
  updatedByProfileId: string;
};

export type CreateLeadFromStudioWebhookInput = {
  teamId: string;
  managerId: string;
  name: string;
  email?: string;
  phone?: string;
  cnpj?: string;
  age?: string;
  currentHealthPlan?: string;
  currentValue?: number;
  referenceHospital?: string;
  currentTreatment?: string;
  source: string;
  metadata?: Record<string, unknown>;
};

export type StudioWebhookLeadResult = {
  id: string;
  leadCode: string;
};

export interface IStudioWebhookIntegrationService {
  getTeamWithMaster(teamId: string): Promise<StudioWebhookTeamSnapshot | null>;
  getWebhookConfigByTeamId(teamId: string): Promise<StudioWebhookConfigSnapshot | null>;
  upsertWebhookConfig(input: UpsertStudioWebhookConfigInput): Promise<StudioWebhookConfigSnapshot>;
  touchWebhookLastUsed(teamId: string): Promise<void>;
  createLeadFromWebhook(input: CreateLeadFromStudioWebhookInput): Promise<StudioWebhookLeadResult>;
}
