import {
  multiskillTransferRepository,
  type MultiskillTransferRepository,
} from "@/app/api/infra/data/repositories/multiskillTransfer/MultiskillTransferRepository";
import { MULTISKILL_MASTER_EMAIL } from "@/lib/multiskill/constants";
import type { ListMultiskillTransferTargetsResult } from "@/lib/multiskill/types";
import type { IMultiskillTransferService } from "./IMultiskillTransferService";

let cachedMultiskillMasterId: string | null = null;

export class MultiskillTransferService implements IMultiskillTransferService {
  constructor(
    private readonly repository: MultiskillTransferRepository = multiskillTransferRepository
  ) {}

  async resolveMultiskillMasterId(): Promise<string | null> {
    if (cachedMultiskillMasterId) return cachedMultiskillMasterId;
    cachedMultiskillMasterId = await this.repository.findMasterIdByEmail(MULTISKILL_MASTER_EMAIL);
    return cachedMultiskillMasterId;
  }

  async resolveDefaultTeamForMaster(masterId: string): Promise<{ id: string; name: string } | null> {
    return this.repository.findDefaultTeamForMaster(masterId);
  }

  async listTransferTargets(input: {
    multiskillMasterId: string;
    query?: string;
    page: number;
    pageSize: number;
  }): Promise<ListMultiskillTransferTargetsResult> {
    return this.repository.listTransferTargets(input);
  }
}

export const multiskillTransferService = new MultiskillTransferService();
