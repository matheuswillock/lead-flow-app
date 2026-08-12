import type { RadarOutboxThroughputLimits } from "@/lib/email/email-contact-radar-sync-outbox-config";

export type OutputLike = {
  isValid: boolean;
  successMessages?: string[];
  errorMessages?: string[];
  result?: unknown;
};

export type RadarOutboxThroughputConfigItem = {
  id: string;
  batchSize: number;
  concurrency: number;
  isActive: boolean;
  updatedByProfileId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EffectiveRadarOutboxThroughputItem = {
  batchSize: number;
  concurrency: number;
  source: "backoffice" | "env";
  theoreticalThroughputPerHour: number;
  limits: RadarOutboxThroughputLimits;
  updatedAt: string | null;
};

export type RadarOutboxThroughputHowItWorks = {
  cronPath: string;
  cronCadence: string;
  cronRunsPerHour: number;
  formula: string;
  precedence: string;
  connectionBudgetHint: string;
};

export type RadarOutboxThroughputSnapshot = {
  config: RadarOutboxThroughputConfigItem | null;
  effective: EffectiveRadarOutboxThroughputItem;
  limits: RadarOutboxThroughputLimits;
  howItWorks: RadarOutboxThroughputHowItWorks;
};

export type UpsertRadarOutboxThroughputPayload = {
  batchSize: number;
  concurrency: number;
};

export interface IBackofficeRadarOutboxThroughputService {
  get(): Promise<RadarOutboxThroughputSnapshot>;
  save(payload: UpsertRadarOutboxThroughputPayload): Promise<OutputLike>;
}
