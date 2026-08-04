import type {
  RadarEngagementConfigItem,
  RadarEngagementWeightItem,
  UpsertRadarEngagementConfigPayload,
  UpsertRadarEngagementWeightPayload,
} from "../services/IBackofficeRadarEngagementService";

export type BackofficeRadarEngagementState = {
  weights: RadarEngagementWeightItem[];
  config: RadarEngagementConfigItem | null;
  isLoading: boolean;
  isSavingWeights: boolean;
  isSavingConfig: boolean;
  error: string | null;
};

export type BackofficeRadarEngagementContextValue = BackofficeRadarEngagementState & {
  canManage: boolean;
  refresh: () => Promise<void>;
  saveWeights: (weights: UpsertRadarEngagementWeightPayload[]) => Promise<boolean>;
  saveConfig: (payload: UpsertRadarEngagementConfigPayload) => Promise<boolean>;
};
