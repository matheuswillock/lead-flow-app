import type {
  BackofficeLeadStatus,
  BackofficeLeadTransitionFieldKey,
} from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";

export type CrmLeadStatusTransitionRuleRow = {
  targetStatus: BackofficeLeadStatus;
  fieldKey: BackofficeLeadTransitionFieldKey;
};

export class BackofficeCrmLeadStatusTransitionFieldRuleRepository {
  async listEnabled(): Promise<CrmLeadStatusTransitionRuleRow[]> {
    return prisma.backofficeCrmLeadStatusTransitionFieldRule.findMany({
      where: { isEnabled: true },
      select: { targetStatus: true, fieldKey: true },
      orderBy: [{ targetStatus: "asc" }, { fieldKey: "asc" }],
    });
  }

  async listGroupedByTargetStatus(): Promise<
    Array<{ targetStatus: BackofficeLeadStatus; fieldKeys: BackofficeLeadTransitionFieldKey[] }>
  > {
    const rows = await prisma.backofficeCrmLeadStatusTransitionFieldRule.findMany({
      where: { isEnabled: true },
      select: { targetStatus: true, fieldKey: true },
      orderBy: [{ targetStatus: "asc" }, { fieldKey: "asc" }],
    });

    const grouped = new Map<BackofficeLeadStatus, BackofficeLeadTransitionFieldKey[]>();
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
    targetStatus: BackofficeLeadStatus,
    fieldKeys: BackofficeLeadTransitionFieldKey[],
    updatedByProfileId: string
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.backofficeCrmLeadStatusTransitionFieldRule.deleteMany({
        where: { targetStatus },
      });

      if (fieldKeys.length === 0) return;

      await tx.backofficeCrmLeadStatusTransitionFieldRule.createMany({
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
    rules: Array<{
      targetStatus: BackofficeLeadStatus;
      fieldKeys: BackofficeLeadTransitionFieldKey[];
    }>,
    updatedByProfileId: string
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.backofficeCrmLeadStatusTransitionFieldRule.deleteMany({});

      const createData = rules.flatMap((rule) =>
        rule.fieldKeys.map((fieldKey) => ({
          targetStatus: rule.targetStatus,
          fieldKey,
          isEnabled: true,
          updatedByProfileId,
        }))
      );

      if (createData.length > 0) {
        await tx.backofficeCrmLeadStatusTransitionFieldRule.createMany({ data: createData });
      }
    });
  }
}

export const backofficeCrmLeadStatusTransitionFieldRuleRepository =
  new BackofficeCrmLeadStatusTransitionFieldRuleRepository();
