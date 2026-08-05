import type {
  FormEngagementScoreRuleItem,
  RadarEngagementConfigItem,
  RadarEngagementWeightItem,
  UpsertFormEngagementScoreRulePayload,
  UpsertRadarEngagementConfigPayload,
  UpsertRadarEngagementWeightPayload,
} from "../services/IBackofficeRadarEngagementService";

export type BackofficeRadarEngagementState = {
  weights: RadarEngagementWeightItem[];
  config: RadarEngagementConfigItem | null;
  formScoreRules: FormEngagementScoreRuleItem[];
  isLoading: boolean;
  isSavingWeights: boolean;
  isSavingConfig: boolean;
  isSavingFormRules: boolean;
  error: string | null;
};

export type BackofficeRadarEngagementContextValue = BackofficeRadarEngagementState & {
  canManage: boolean;
  refresh: () => Promise<void>;
  saveWeights: (weights: UpsertRadarEngagementWeightPayload[]) => Promise<boolean>;
  saveConfig: (payload: UpsertRadarEngagementConfigPayload) => Promise<boolean>;
  saveFormScoreRules: (rules: UpsertFormEngagementScoreRulePayload[]) => Promise<boolean>;
  deleteFormScoreRule: (id: string) => Promise<boolean>;
};
