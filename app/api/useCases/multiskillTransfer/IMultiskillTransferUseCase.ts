import type { TeamAccess } from "@/app/api/v1/utils/teamAccess";
import { Output } from "@/lib/output";
import type { TransferMultiskillLeadRequest } from "../../v1/leads/DTO/requestToTransferMultiskillLead";

export interface IMultiskillTransferUseCase {
  listTransferTargets(
    ctx: TeamAccess,
    input: { query?: string; page: number; pageSize: number }
  ): Promise<Output>;
  transferLead(
    ctx: TeamAccess,
    leadId: string,
    data: TransferMultiskillLeadRequest
  ): Promise<Output>;
}
