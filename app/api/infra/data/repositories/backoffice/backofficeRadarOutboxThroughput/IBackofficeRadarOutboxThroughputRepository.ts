export type BackofficeRadarOutboxThroughputConfigRow = {
  id: string;
  batchSize: number;
  concurrency: number;
  isActive: boolean;
  updatedByProfileId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UpsertBackofficeRadarOutboxThroughputConfigInput = {
  batchSize: number;
  concurrency: number;
  updatedByProfileId?: string | null;
};

export interface IBackofficeRadarOutboxThroughputRepository {
  getActiveConfig(): Promise<BackofficeRadarOutboxThroughputConfigRow | null>;
  upsertActiveConfig(
    input: UpsertBackofficeRadarOutboxThroughputConfigInput
  ): Promise<BackofficeRadarOutboxThroughputConfigRow>;
}
