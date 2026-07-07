import type { Prisma, TeamAutomationRule, TeamAutomationRunLog } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";

export type TeamAutomationRuleSelect = {
  id: string;
  teamId: string;
  createdBy: string;
  name: string;
  description: string | null;
  triggerType: TeamAutomationRule["triggerType"];
  triggerConfig: Prisma.JsonValue;
  actionType: TeamAutomationRule["actionType"];
  actionConfig: Prisma.JsonValue;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const ruleSelect = {
  id: true,
  teamId: true,
  createdBy: true,
  name: true,
  description: true,
  triggerType: true,
  triggerConfig: true,
  actionType: true,
  actionConfig: true,
  isEnabled: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TeamAutomationRuleSelect;

export interface ITeamAutomationRuleRepository {
  listByTeam(teamId: string): Promise<TeamAutomationRuleSelect[]>;
  findById(teamId: string, ruleId: string): Promise<TeamAutomationRuleSelect | null>;
  findEnabledByTeamAndTrigger(
    teamId: string,
    triggerType: TeamAutomationRule["triggerType"]
  ): Promise<TeamAutomationRuleSelect[]>;
  findAllEnabledByTrigger(
    triggerType: TeamAutomationRule["triggerType"]
  ): Promise<TeamAutomationRuleSelect[]>;
  create(data: Prisma.TeamAutomationRuleCreateInput): Promise<TeamAutomationRuleSelect>;
  update(
    ruleId: string,
    data: Prisma.TeamAutomationRuleUpdateInput
  ): Promise<TeamAutomationRuleSelect>;
  delete(ruleId: string): Promise<void>;
  toggle(ruleId: string, isEnabled: boolean): Promise<TeamAutomationRuleSelect>;
  listRuns(
    teamId: string,
    ruleId: string,
    page: number,
    pageSize: number
  ): Promise<{ items: TeamAutomationRunLog[]; total: number }>;
  countMessagingActionsToday(ruleId: string): Promise<number>;
  tryCreateRunLog(data: Prisma.TeamAutomationRunLogCreateInput): Promise<TeamAutomationRunLog | null>;
  updateRunLog(
    id: string,
    data: Prisma.TeamAutomationRunLogUpdateInput
  ): Promise<TeamAutomationRunLog>;
}

export class TeamAutomationRuleRepository implements ITeamAutomationRuleRepository {
  async listByTeam(teamId: string) {
    return prisma.teamAutomationRule.findMany({
      where: { teamId },
      select: ruleSelect,
      orderBy: [{ isEnabled: "desc" }, { updatedAt: "desc" }],
    });
  }

  async findById(teamId: string, ruleId: string) {
    return prisma.teamAutomationRule.findFirst({
      where: { id: ruleId, teamId },
      select: ruleSelect,
    });
  }

  async findEnabledByTeamAndTrigger(teamId: string, triggerType: TeamAutomationRule["triggerType"]) {
    return prisma.teamAutomationRule.findMany({
      where: { teamId, triggerType, isEnabled: true },
      select: ruleSelect,
    });
  }

  async findAllEnabledByTrigger(triggerType: TeamAutomationRule["triggerType"]) {
    return prisma.teamAutomationRule.findMany({
      where: { triggerType, isEnabled: true },
      select: ruleSelect,
    });
  }

  async create(data: Prisma.TeamAutomationRuleCreateInput) {
    return prisma.teamAutomationRule.create({ data, select: ruleSelect });
  }

  async update(ruleId: string, data: Prisma.TeamAutomationRuleUpdateInput) {
    return prisma.teamAutomationRule.update({
      where: { id: ruleId },
      data,
      select: ruleSelect,
    });
  }

  async delete(ruleId: string) {
    await prisma.teamAutomationRule.delete({ where: { id: ruleId } });
  }

  async toggle(ruleId: string, isEnabled: boolean) {
    return prisma.teamAutomationRule.update({
      where: { id: ruleId },
      data: { isEnabled },
      select: ruleSelect,
    });
  }

  async listRuns(teamId: string, ruleId: string, page: number, pageSize: number) {
    const where = { teamId, ruleId };
    const [items, total] = await Promise.all([
      prisma.teamAutomationRunLog.findMany({
        where,
        orderBy: { executedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.teamAutomationRunLog.count({ where }),
    ]);
    return { items, total };
  }

  async countMessagingActionsToday(ruleId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return prisma.teamAutomationRunLog.count({
      where: {
        ruleId,
        status: { in: ["success", "failed"] },
        executedAt: { gte: startOfDay },
      },
    });
  }

  async tryCreateRunLog(data: Prisma.TeamAutomationRunLogCreateInput) {
    try {
      return await prisma.teamAutomationRunLog.create({ data });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("Unique constraint") || (error as { code?: string }).code === "P2002")
      ) {
        return null;
      }
      throw error;
    }
  }

  async updateRunLog(id: string, data: Prisma.TeamAutomationRunLogUpdateInput) {
    return prisma.teamAutomationRunLog.update({ where: { id }, data });
  }
}

export const teamAutomationRuleRepository = new TeamAutomationRuleRepository();
