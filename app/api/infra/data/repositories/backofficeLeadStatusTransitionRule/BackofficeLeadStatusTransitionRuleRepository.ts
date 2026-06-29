import type { BackofficeLeadTransitionFieldKey, LeadStatus } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";

export type LeadStatusTransitionRuleRow = {
  targetStatus: LeadStatus;
  fieldKey: BackofficeLeadTransitionFieldKey;
};

export class BackofficeLeadStatusTransitionRuleRepository {
  async listEnabled(): Promise<LeadStatusTransitionRuleRow[]> {
    return prisma.backofficeLeadStatusTransitionFieldRule.findMany({
      where: { isEnabled: true },
      select: { targetStatus: true, fieldKey: true },
      orderBy: [{ targetStatus: "asc" }, { fieldKey: "asc" }],
    });
  }

  async listGroupedByTargetStatus(): Promise<
    Array<{ targetStatus: LeadStatus; fieldKeys: BackofficeLeadTransitionFieldKey[] }>
  > {
    const rows = await prisma.backofficeLeadStatusTransitionFieldRule.findMany({
      where: { isEnabled: true },
      select: { targetStatus: true, fieldKey: true },
      orderBy: [{ targetStatus: "asc" }, { fieldKey: "asc" }],
    });

    const grouped = new Map<LeadStatus, BackofficeLeadTransitionFieldKey[]>();
    for (const row of rows) {
      const current = grouped.get(row.targetStatus) ?? [];
      current.push(row.fieldKey);
      grouped.set(row.targetStatus, current);
    }

    return Array.from(grouped.entries()).map(([targetStatus, fieldKeys]) => ({
      targetStatus,
      fieldKeys,
    }));
  }

  async replaceRulesForTargetStatus(
    targetStatus: LeadStatus,
    fieldKeys: BackofficeLeadTransitionFieldKey[],
    updatedByProfileId: string
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.backofficeLeadStatusTransitionFieldRule.deleteMany({
        where: { targetStatus },
      });

      if (fieldKeys.length === 0) return;

      await tx.backofficeLeadStatusTransitionFieldRule.createMany({
        data: fieldKeys.map((fieldKey) => ({
          targetStatus,
          fieldKey,
          isEnabled: true,
          updatedByProfileId,
        })),
      });
    });
  }

  async replaceAllRules(
    rules: Array<{ targetStatus: LeadStatus; fieldKeys: BackofficeLeadTransitionFieldKey[] }>,
    updatedByProfileId: string
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.backofficeLeadStatusTransitionFieldRule.deleteMany({});

      const createData = rules.flatMap((rule) =>
        rule.fieldKeys.map((fieldKey) => ({
          targetStatus: rule.targetStatus,
          fieldKey,
          isEnabled: true,
          updatedByProfileId,
        }))
      );

      if (createData.length > 0) {
        await tx.backofficeLeadStatusTransitionFieldRule.createMany({ data: createData });
      }
    });
  }
}

export const backofficeLeadStatusTransitionRuleRepository =
  new BackofficeLeadStatusTransitionRuleRepository();
