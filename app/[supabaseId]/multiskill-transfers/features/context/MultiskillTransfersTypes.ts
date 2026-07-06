import type {
  ListMultiskillTransferTargetsResult,
  MultiskillTransferTarget,
  MultiskillTransferTargetCloser,
} from "@/lib/multiskill/types";

export type { MultiskillTransferTargetCloser };
export type MultiskillTransferTargetRow = MultiskillTransferTarget;
export type MultiskillTransfersData = ListMultiskillTransferTargetsResult;

export interface MultiskillTransfersFiltersState {
  q: string;
  page: number;
  pageSize: number;
}

export const DEFAULT_MULTISKILL_TRANSFERS_FILTERS: MultiskillTransfersFiltersState = {
  q: "",
  page: 1,
  pageSize: 20,
};

export interface IMultiskillTransfersState {
  isLoading: boolean;
  error: string | null;
  data: MultiskillTransfersData | null;
  filters: MultiskillTransfersFiltersState;
}

export interface IMultiskillTransfersActions {
  load: () => Promise<void>;
  setFilters: (patch: Partial<MultiskillTransfersFiltersState>) => void;
}

export interface IMultiskillTransfersContext
  extends IMultiskillTransfersState,
    IMultiskillTransfersActions {}
