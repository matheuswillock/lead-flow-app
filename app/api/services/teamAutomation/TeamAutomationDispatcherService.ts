import type { LeadStatus } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import {
  teamAutomationRuleRepository,
  type TeamAutomationRuleSelect,
} from "@/app/api/infra/data/repositories/teamAutomation/TeamAutomationRuleRepository";
import { buildAutomationDedupeKey } from "@/lib/team-automation/dedupe";
import { sanitizeRunLogPayload } from "@/lib/team-automation/template";
import {
  DAILY_MESSAGING_ACTION_LIMIT,
  type ActionConfigBase,
  type TeamAutomationEvent,
  type TriggerConfigBase,
} from "@/lib/team-automation/types";
import type { ITeamAutomationDispatcherService } from "./ITeamAutomationDispatcherService";
import { AssignOperatorExecutor } from "./executors/AssignOperatorExecutor";
import { CreateNotificationExecutor } from "./executors/CreateNotificationExecutor";
import type { IAutomationActionExecutor } from "./executors/IAutomationActionExecutor";
import { SendEmailExecutor } from "./executors/SendEmailExecutor";
import { SendWhatsAppMessageExecutor } from "./executors/SendWhatsAppMessageExecutor";

const MESSAGING_ACTIONS = new Set(["send_whatsapp_message", "send_email"]);

export class TeamAutomationDispatcherService implements ITeamAutomationDispatcherService {
  constructor(
    private readonly executors: IAutomationActionExecutor[] = [
      new SendWhatsAppMessageExecutor(),
      new SendEmailExecutor(),
      new CreateNotificationExecutor(),
      new AssignOperatorExecutor(),
    ]
  ) {}

  async dispatch(event: TeamAutomationEvent): Promise<void> {
    try {
      const rules = await teamAutomationRuleRepository.findEnabledByTeamAndTrigger(
        event.teamId,
        event.type
      );

      if (rules.length === 0) return;

      const lead = await prisma.lead.findFirst({
        where: { id: event.leadId, teamId: event.teamId },
        select: {
          id: true,
          teamId: true,
          name: true,
          status: true,
          leadCode: true,
          email: true,
          phone: true,
          assignedTo: true,
        },
      });

      if (!lead) return;

      const dedupeKey = buildAutomationDedupeKey(event);

      for (const rule of rules) {
        await this.processRule(rule, lead, event, dedupeKey).catch((error) => {
          console.error("[TeamAutomationDispatcherService] Erro ao processar regra:", {
            ruleId: rule.id,
            error,
          });
        });
      }
    } catch (error) {
      console.error("[TeamAutomationDispatcherService][dispatch] Erro:", error);
    }
  }

  private async processRule(
    rule: TeamAutomationRuleSelect,
    lead: {
      id: string;
      teamId: string;
      name: string;
      status: LeadStatus | null;
      leadCode: string | null;
      email: string | null;
      phone: string | null;
      assignedTo: string | null;
    },
    event: TeamAutomationEvent,
    dedupeKey: string
  ) {
    const triggerConfig = rule.triggerConfig as TriggerConfigBase;

    if (!this.matchesTrigger(rule, triggerConfig, event)) {
      return;
    }

    const runLog = await teamAutomationRuleRepository.tryCreateRunLog({
      rule: { connect: { id: rule.id } },
      team: { connect: { id: rule.teamId } },
      leadId: lead.id,
      dedupeKey,
      status: "skipped",
      errorMessage: null,
      payload: null,
    });

    if (!runLog) return;

    if (MESSAGING_ACTIONS.has(rule.actionType)) {
      const count = await teamAutomationRuleRepository.countMessagingActionsToday(rule.id);
      if (count >= DAILY_MESSAGING_ACTION_LIMIT) {
        await teamAutomationRuleRepository.updateRunLog(runLog.id, {
          status: "skipped",
          errorMessage: `Limite diário de ${DAILY_MESSAGING_ACTION_LIMIT} envios atingido para esta regra`,
        });
        return;
      }
    }

    const executor = this.executors.find((item) => item.actionType === rule.actionType);
    if (!executor) {
      await teamAutomationRuleRepository.updateRunLog(runLog.id, {
        status: "failed",
        errorMessage: `Executor não encontrado para ${rule.actionType}`,
      });
      return;
    }

    try {
      const result = await executor.execute({
        rule,
        lead,
        triggerConfig,
        actionConfig: rule.actionConfig as ActionConfigBase,
      });

      await teamAutomationRuleRepository.updateRunLog(runLog.id, {
        status: result.status,
        errorMessage: result.errorMessage ?? null,
        payload: result.payload ? sanitizeRunLogPayload(result.payload) : null,
      });
    } catch (error) {
      console.error("[TeamAutomationDispatcherService] Executor error:", error);
      await teamAutomationRuleRepository.updateRunLog(runLog.id, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Erro na execução",
      });
    }
  }

  private matchesTrigger(
    rule: TeamAutomationRuleSelect,
    triggerConfig: TriggerConfigBase,
    event: TeamAutomationEvent
  ): boolean {
    const data = event.data ?? {};

    switch (rule.triggerType) {
      case "status_changed":
        return triggerConfig.targetStatus === (data.newStatus as LeadStatus | undefined);
      case "lead_idle_in_status":
        return triggerConfig.targetStatus === (data.status as LeadStatus | undefined);
      default:
        return event.type === rule.triggerType;
    }
  }
}

export const teamAutomationDispatcherService = new TeamAutomationDispatcherService();
