export type BackofficeRadarEngagementWeightRow = {
  id: string;
  eventType: string;
  weight: number;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type UpsertBackofficeRadarEngagementWeightInput = {
  eventType: string;
  weight: number;
  description?: string | null;
  isActive?: boolean;
};

export type BackofficeRadarEngagementConfigRow = {
  id: string;
  windowRecentDays: number;
  windowMidDays: number;
  windowOldDays: number;
  recentMultiplier: number;
  oldMultiplier: number;
  hotThreshold: number;
  warmThreshold: number;
  lukewarmThreshold: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type UpsertBackofficeRadarEngagementConfigInput = {
  windowRecentDays: number;
  windowMidDays: number;
  windowOldDays: number;
  recentMultiplier: number;
  oldMultiplier: number;
  hotThreshold: number;
  warmThreshold: number;
  lukewarmThreshold: number;
};

export interface IBackofficeRadarEngagementRepository {
  listWeights(): Promise<BackofficeRadarEngagementWeightRow[]>;
  upsertWeights(
    items: UpsertBackofficeRadarEngagementWeightInput[]
  ): Promise<BackofficeRadarEngagementWeightRow[]>;
  getActiveConfig(): Promise<BackofficeRadarEngagementConfigRow | null>;
  upsertActiveConfig(
    input: UpsertBackofficeRadarEngagementConfigInput
  ): Promise<BackofficeRadarEngagementConfigRow>;
}
