import {
  multiskillTransferRepository,
  type MultiskillTransferRepository,
} from "@/app/api/infra/data/repositories/multiskillTransfer/MultiskillTransferRepository";
import type { ListMultiskillTransferTargetsResult } from "@/lib/multiskill/types";
import type { IMultiskillTransferService } from "./IMultiskillTransferService";

export class MultiskillTransferService implements IMultiskillTransferService {
  constructor(
    private readonly repository: MultiskillTransferRepository = multiskillTransferRepository
  ) {}

  async resolveDefaultTeamForMaster(masterId: string): Promise<{ id: string; name: string } | null> {
    return this.repository.findDefaultTeamForMaster(masterId);
  }

  async listTransferTargets(input: {
    originMasterId: string;
    query?: string;
    page: number;
    pageSize: number;
  }): Promise<ListMultiskillTransferTargetsResult> {
    return this.repository.listTransferTargets(input);
  }
}

export const multiskillTransferService = new MultiskillTransferService();
