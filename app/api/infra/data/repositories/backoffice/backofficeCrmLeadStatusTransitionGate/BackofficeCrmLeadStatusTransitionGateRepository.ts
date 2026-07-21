import type {
  BackofficeLeadStatus,
  BackofficeLeadTransitionGateType,
} from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import type { CrmLeadStatusTransitionGateRow } from "@/lib/backoffice-crm-lead-status-transition-gates";

export type BackofficeCrmLeadStatusTransitionGateRecord = CrmLeadStatusTransitionGateRow & {
  updatedByProfileId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type UpdateCrmLeadStatusTransitionGateInput = {
  name: string;
  gateType: BackofficeLeadTransitionGateType;
  sourceStatus?: BackofficeLeadStatus | null;
  targetStatus?: BackofficeLeadStatus | null;
  config: unknown;
  blockerType: string;
  errorMessage?: string | null;
  isEnabled: boolean;
  sortOrder: number;
};

export class BackofficeCrmLeadStatusTransitionGateRepository {
  async listEnabled(): Promise<CrmLeadStatusTransitionGateRow[]> {
    return prisma.backofficeCrmLeadStatusTransitionGate.findMany({
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

  async listAll(): Promise<BackofficeCrmLeadStatusTransitionGateRecord[]> {
    return prisma.backofficeCrmLeadStatusTransitionGate.findMany({
      orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
    });
  }

  async updateGate(
    id: string,
    data: UpdateCrmLeadStatusTransitionGateInput,
    updatedByProfileId: string
  ): Promise<BackofficeCrmLeadStatusTransitionGateRecord> {
    return prisma.backofficeCrmLeadStatusTransitionGate.update({
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
}

export const backofficeCrmLeadStatusTransitionGateRepository =
  new BackofficeCrmLeadStatusTransitionGateRepository();
