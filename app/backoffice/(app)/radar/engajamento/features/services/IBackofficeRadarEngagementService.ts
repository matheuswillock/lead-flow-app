export type RadarEngagementWeightItem = {
  id: string;
  eventType: string;
  weight: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RadarEngagementConfigItem = {
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
  createdAt: string;
  updatedAt: string;
};

export type UpsertRadarEngagementWeightPayload = {
  eventType: string;
  weight: number;
  description?: string | null;
  isActive?: boolean;
};

export type UpsertRadarEngagementConfigPayload = {
  windowRecentDays: number;
  windowMidDays: number;
  windowOldDays: number;
  recentMultiplier: number;
  oldMultiplier: number;
  hotThreshold: number;
  warmThreshold: number;
  lukewarmThreshold: number;
};

export type OutputLike = {
  isValid: boolean;
  successMessages: string[];
  errorMessages: string[];
};

export interface IBackofficeRadarEngagementService {
  listWeights(): Promise<RadarEngagementWeightItem[]>;
  saveWeights(weights: UpsertRadarEngagementWeightPayload[]): Promise<OutputLike>;
  getConfig(): Promise<RadarEngagementConfigItem | null>;
  saveConfig(payload: UpsertRadarEngagementConfigPayload): Promise<OutputLike>;
}
