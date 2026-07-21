import type { ListMultiskillTransferTargetsResult } from "@/lib/multiskill/types";
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess";

export type {
  ListMultiskillTransferTargetsResult,
  MultiskillTransferTarget,
  MultiskillTransferTargetCloser,
} from "@/lib/multiskill/types";

export interface IMultiskillTransferService {
  listTransferTargets(input: {
    originMasterId: string;
    query?: string;
    page: number;
    pageSize: number;
  }): Promise<ListMultiskillTransferTargetsResult>;
  resolveDefaultTeamForMaster(masterId: string): Promise<{ id: string; name: string } | null>;
}

export type MultiskillCallerContext = TeamAccess;
