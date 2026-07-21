import { prisma } from "@/app/api/infra/data/prisma";
import {
  teamAutomationRuleRepository,
} from "@/app/api/infra/data/repositories/teamAutomation/TeamAutomationRuleRepository";
import type { AutomationRuleInput, AutomationRuleUpdateInput } from "@/lib/team-automation/types";
import { validateActionConfigForType } from "@/lib/team-automation/validation";
import type { ITeamAutomationRuleService } from "./ITeamAutomationRuleService";

export class TeamAutomationRuleService implements ITeamAutomationRuleService {
  async listByTeam(teamId: string) {
    return teamAutomationRuleRepository.listByTeam(teamId);
  }

  async findById(teamId: string, ruleId: string) {
    return teamAutomationRuleRepository.findById(teamId, ruleId);
  }

  async create(teamId: string, createdBy: string, input: AutomationRuleInput) {
    const actionValidation = validateActionConfigForType(input.actionType, input.actionConfig);
    if (!actionValidation.success) {
      throw new Error(actionValidation.error.issues.map((i) => i.message).join(", "));
    }

    if (input.actionType === "create_notification" && input.actionConfig.notifyProfileIds?.length) {
      const valid = await this.validateNotifyProfileIds(teamId, input.actionConfig.notifyProfileIds);
      if (!valid) {
        throw new Error("notifyProfileIds contém perfis fora do time");
      }
    }

    return teamAutomationRuleRepository.create({
      team: { connect: { id: teamId } },
      creator: { connect: { id: createdBy } },
      name: input.name.trim(),
      description: input.description?.trim() || null,
      triggerType: input.triggerType,
      triggerConfig: input.triggerConfig,
      actionType: input.actionType,
      actionConfig: input.actionConfig,
      isEnabled: input.isEnabled ?? true,
    });
  }

  async update(teamId: string, ruleId: string, input: AutomationRuleUpdateInput) {
    const existing = await teamAutomationRuleRepository.findById(teamId, ruleId);
    if (!existing) return null;

    const actionType = input.actionType ?? existing.actionType;
    const actionConfig = (input.actionConfig ?? existing.actionConfig) as Record<string, unknown>;
    const actionValidation = validateActionConfigForType(actionType, actionConfig);
    if (!actionValidation.success) {
      throw new Error(actionValidation.error.issues.map((i) => i.message).join(", "));
    }

    if (actionType === "create_notification" && Array.isArray(actionConfig.notifyProfileIds)) {
      const valid = await this.validateNotifyProfileIds(
        teamId,
        actionConfig.notifyProfileIds as string[]
      );
      if (!valid) {
        throw new Error("notifyProfileIds contém perfis fora do time");
      }
    }

    return teamAutomationRuleRepository.update(ruleId, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.triggerType !== undefined ? { triggerType: input.triggerType } : {}),
      ...(input.triggerConfig !== undefined ? { triggerConfig: input.triggerConfig } : {}),
      ...(input.actionType !== undefined ? { actionType: input.actionType } : {}),
      ...(input.actionConfig !== undefined ? { actionConfig: input.actionConfig } : {}),
      ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
    });
  }

  async remove(teamId: string, ruleId: string) {
    const existing = await teamAutomationRuleRepository.findById(teamId, ruleId);
    if (!existing) return false;
    await teamAutomationRuleRepository.delete(ruleId);
    return true;
  }

  async toggle(teamId: string, ruleId: string, isEnabled: boolean) {
    const existing = await teamAutomationRuleRepository.findById(teamId, ruleId);
    if (!existing) return null;
    return teamAutomationRuleRepository.toggle(ruleId, isEnabled);
  }

  async listRuns(teamId: string, ruleId: string, page: number, pageSize: number) {
    return teamAutomationRuleRepository.listRuns(teamId, ruleId, page, pageSize);
  }

  async validateNotifyProfileIds(teamId: string, profileIds: string[]) {
    if (profileIds.length === 0) return true;
    const members = await prisma.teamMember.findMany({
      where: { teamId, profileId: { in: profileIds } },
      select: { profileId: true },
    });
    return members.length === profileIds.length;
  }
}

export const teamAutomationRuleService = new TeamAutomationRuleService();
