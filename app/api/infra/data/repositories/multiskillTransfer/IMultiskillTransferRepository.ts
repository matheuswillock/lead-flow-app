import type { Prisma } from "@prisma/client";
import type { TransferToTeamSanitization } from "@/app/api/infra/data/repositories/lead/ILeadRepository";
import type {
  ListMultiskillTransferTargetsResult,
  MultiskillTransferLeadRecord,
} from "@/lib/multiskill/types";

export interface IMultiskillTransferRepository {
  findMasterIdByEmail(email: string): Promise<string | null>;
  findDefaultTeamForMaster(masterId: string): Promise<{ id: string; name: string } | null>;
  listTransferTargets(input: {
    multiskillMasterId: string;
    query?: string;
    page: number;
    pageSize: number;
  }): Promise<ListMultiskillTransferTargetsResult>;
  resolveTransferTeamUniqueConflicts(
    lead: { id: string; email: string | null; cnpj: string | null },
    targetTeamId: string
  ): Promise<{ ok: true; sanitizations: TransferToTeamSanitization[] } | { ok: false; message: string }>;
  findLeadForMultiskillTransfer(leadId: string): Promise<MultiskillTransferLeadRecord | null>;
  findMasterMultiskillProfile(masterId: string): Promise<{ id: string; multiskillEnabled: boolean } | null>;
  findCloserOnDefaultTeam(input: {
    defaultTeamId: string;
    closerId: string;
    masterId: string;
  }): Promise<boolean>;
  findSdrOnDefaultTeam(input: {
    defaultTeamId: string;
    sdrId: string;
    masterId: string;
  }): Promise<boolean>;
  findTransferDelegationMembership(teamId: string, profileId: string): Promise<{
    role: string;
    canTransferAccountLeads: boolean;
  } | null>;
  clearLeadTransferFlag(leadId: string): Promise<{ id: string }>;
  createMultiskillLeadTransfer(data: {
    leadId: string;
    fromTeamId: string;
    toTeamId: string;
    transferredByProfileId: string;
    receivedByProfileId: string;
    fromManagerId: string;
    toManagerId: string;
    transferTagUsed: boolean;
    preScheduledAt: Date | null;
  }): Promise<unknown>;
}

export type MultiskillTransferSearchFilter = Prisma.ProfileWhereInput;
