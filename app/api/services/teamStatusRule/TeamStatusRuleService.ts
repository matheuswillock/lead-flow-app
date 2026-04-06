import { LeadStatus, TeamLeadTimeUnit, TeamStatusRule, TeamStatusRuleType } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import {
  ITeamStatusRuleService,
  ReplaceTeamStatusRulesInput,
  TeamStatusCombinedRuleInput,
  TeamStatusLeadTimeRuleInput,
} from "./ITeamStatusRuleService";

const dedupeStatuses = (statuses: LeadStatus[]) => {
  return Array.from(new Set(statuses));
};

const dedupeLeadTimeRules = (rules: TeamStatusLeadTimeRuleInput[]) => {
  const map = new Map<LeadStatus, TeamStatusLeadTimeRuleInput>();
  rules.forEach((rule) => {
    if (!rule.leadTimeValue || rule.leadTimeValue <= 0) return;
    if (!rule.leadTimeUnit || !Object.values(TeamLeadTimeUnit).includes(rule.leadTimeUnit)) return;
    map.set(rule.status, rule);
  });
  return Array.from(map.values());
};

const dedupeCombinedRules = (rules: TeamStatusCombinedRuleInput[]) => {
  const seen = new Set<string>();
  const normalized: TeamStatusCombinedRuleInput[] = [];
  rules.forEach((rule) => {
    if (!rule.targetStatus || !rule.requiredStatus) return;
    const key = `${rule.targetStatus}:${rule.requiredStatus}:${rule.confirmationMessage || ""}:${rule.requireConfirmation ? "1" : "0"}`;
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push(rule);
  });
  return normalized;
};

export class TeamStatusRuleService implements ITeamStatusRuleService {
  async listByTeam(teamId: string): Promise<TeamStatusRule[]> {
    return prisma.teamStatusRule.findMany({
      where: { teamId },
      orderBy: [{ type: "asc" }, { targetStatus: "asc" }, { createdAt: "asc" }],
    });
  }

  async replaceByTeam(teamId: string, createdBy: string, input: ReplaceTeamStatusRulesInput): Promise<TeamStatusRule[]> {
    const disabledStatuses = dedupeStatuses(input.disabledStatuses || []);
    const leadTimeRules = dedupeLeadTimeRules(input.leadTimeRules || []);
    const combinedRules = dedupeCombinedRules(input.combinedRules || []);

    return prisma.$transaction(async (tx) => {
      await tx.teamStatusRule.deleteMany({
        where: { teamId },
      });

      const createData = [
        ...disabledStatuses.map((status) => ({
          teamId,
          createdBy,
          type: TeamStatusRuleType.disabled_status,
          targetStatus: status,
          requiredStatus: null,
          leadTimeValue: null,
          leadTimeUnit: null,
          requireConfirmation: false,
          confirmationMessage: null,
          isEnabled: true,
        })),
        ...leadTimeRules.map((rule) => ({
          teamId,
          createdBy,
          type: TeamStatusRuleType.lead_time,
          targetStatus: rule.status,
          requiredStatus: null,
          leadTimeValue: rule.leadTimeValue,
          leadTimeUnit: rule.leadTimeUnit,
          requireConfirmation: false,
          confirmationMessage: null,
          isEnabled: true,
        })),
        ...combinedRules.map((rule) => ({
          teamId,
          createdBy,
          type: TeamStatusRuleType.combined_transition,
          targetStatus: rule.targetStatus,
          requiredStatus: rule.requiredStatus,
          leadTimeValue: null,
          leadTimeUnit: null,
          requireConfirmation: rule.requireConfirmation === true,
          confirmationMessage: rule.confirmationMessage?.trim() || null,
          isEnabled: rule.isEnabled !== false,
        })),
      ];

      if (createData.length > 0) {
        await tx.teamStatusRule.createMany({
          data: createData,
        });
      }

      return tx.teamStatusRule.findMany({
        where: { teamId },
        orderBy: [{ type: "asc" }, { targetStatus: "asc" }, { createdAt: "asc" }],
      });
    });
  }

  async findActiveByTargetStatus(teamId: string, targetStatus: LeadStatus): Promise<TeamStatusRule[]> {
    return prisma.teamStatusRule.findMany({
      where: {
        teamId,
        isEnabled: true,
        targetStatus,
      },
      orderBy: [{ type: "asc" }, { createdAt: "asc" }],
    });
  }
}

export const teamStatusRuleService: ITeamStatusRuleService = new TeamStatusRuleService();

