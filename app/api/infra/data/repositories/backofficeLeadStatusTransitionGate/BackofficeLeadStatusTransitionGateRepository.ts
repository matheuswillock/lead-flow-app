import type { BackofficeLeadTransitionGateType, LeadStatus } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import type { LeadStatusTransitionGateRow } from "@/lib/leadStatusTransitionGates";

export type BackofficeLeadStatusTransitionGateRecord = LeadStatusTransitionGateRow & {
  updatedByProfileId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type UpdateLeadStatusTransitionGateInput = {
  name: string;
  gateType: BackofficeLeadTransitionGateType;
  sourceStatus?: LeadStatus | null;
  targetStatus?: LeadStatus | null;
  config: unknown;
  blockerType: string;
  errorMessage?: string | null;
  isEnabled: boolean;
  sortOrder: number;
};

export class BackofficeLeadStatusTransitionGateRepository {
  async listEnabled(): Promise<LeadStatusTransitionGateRow[]> {
    return prisma.backofficeLeadStatusTransitionGate.findMany({
      where: { isEnabled: true },
      select: {
        id: true,
        slug: true,
        name: true,
        gateType: true,
        sourceStatus: true,
        targetStatus: true,
        config: true,
        blockerType: true,
        errorMessage: true,
        isEnabled: true,
        sortOrder: true,
      },
      orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
    });
  }

  async listAll(): Promise<BackofficeLeadStatusTransitionGateRecord[]> {
    return prisma.backofficeLeadStatusTransitionGate.findMany({
      orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
    });
  }

  async updateGate(
    id: string,
    data: UpdateLeadStatusTransitionGateInput,
    updatedByProfileId: string
  ): Promise<BackofficeLeadStatusTransitionGateRecord> {
    return prisma.backofficeLeadStatusTransitionGate.update({
      where: { id },
      data: {
        name: data.name,
        gateType: data.gateType,
        sourceStatus: data.sourceStatus ?? null,
        targetStatus: data.targetStatus ?? null,
        config: data.config as object,
        blockerType: data.blockerType,
        errorMessage: data.errorMessage ?? null,
        isEnabled: data.isEnabled,
        sortOrder: data.sortOrder,
        updatedByProfileId,
      },
    });
  }

  async findTeamMasterId(teamId: string): Promise<string | null> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { masterId: true },
    });
    return team?.masterId ?? null;
  }
}

export const backofficeLeadStatusTransitionGateRepository =
  new BackofficeLeadStatusTransitionGateRepository();
