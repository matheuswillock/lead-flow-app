import type {
  IBackofficeRadarOutboxThroughputService,
  RadarOutboxThroughputSnapshot,
  UpsertRadarOutboxThroughputPayload,
} from "../services/IBackofficeRadarOutboxThroughputService";

export type BackofficeRadarOutboxThroughputState = {
  snapshot: RadarOutboxThroughputSnapshot | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
};

export type BackofficeRadarOutboxThroughputContextValue =
  BackofficeRadarOutboxThroughputState & {
    canManage: boolean;
    refresh: () => Promise<void>;
    save: (payload: UpsertRadarOutboxThroughputPayload) => Promise<boolean>;
  };

export type BackofficeRadarOutboxThroughputHookResult = {
  state: BackofficeRadarOutboxThroughputState;
  refresh: () => Promise<void>;
  setSaving: (value: boolean) => void;
  service: IBackofficeRadarOutboxThroughputService;
};
