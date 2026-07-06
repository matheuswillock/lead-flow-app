import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import type { LeadStatus } from "@prisma/client";
import { teamAutomationRuleRepository } from "@/app/api/infra/data/repositories/teamAutomation/TeamAutomationRuleRepository";
import { teamAutomationDispatcherService } from "@/app/api/services/teamAutomation/TeamAutomationDispatcherService";
import type { TriggerConfigBase } from "@/lib/team-automation/types";

const BATCH_SIZE = 200;

export interface IEvaluateIdleLeadsUseCase {
  evaluate(): Promise<Output>;
}

export class EvaluateIdleLeadsUseCase implements IEvaluateIdleLeadsUseCase {
  async evaluate(): Promise<Output> {
    try {
      const rules = await teamAutomationRuleRepository.findAllEnabledByTrigger("lead_idle_in_status");
      let processedLeads = 0;
      let dispatched = 0;

      for (const rule of rules) {
        const triggerConfig = rule.triggerConfig as TriggerConfigBase;
        if (!triggerConfig.targetStatus || !triggerConfig.idleValue || !triggerConfig.idleUnit) {
          continue;
        }

        const thresholdMs = this.toThresholdMs(triggerConfig.idleValue, triggerConfig.idleUnit);
        const cutoff = new Date(Date.now() - thresholdMs);
        let page = 0;

        while (true) {
          const leads = await prisma.lead.findMany({
            where: {
              teamId: rule.teamId,
              status: triggerConfig.targetStatus as LeadStatus,
              statusEnteredAt: { lte: cutoff },
            },
            select: {
              id: true,
              teamId: true,
              status: true,
              statusEnteredAt: true,
            },
            orderBy: { statusEnteredAt: "asc" },
            skip: page * BATCH_SIZE,
            take: BATCH_SIZE,
          });

          if (leads.length === 0) break;

          for (const lead of leads) {
            processedLeads += 1;
            await teamAutomationDispatcherService.dispatch({
              type: "lead_idle_in_status",
              teamId: lead.teamId,
              leadId: lead.id,
              data: {
                status: lead.status,
                statusEnteredAt: lead.statusEnteredAt.toISOString(),
              },
            });
            dispatched += 1;
          }

          if (leads.length < BATCH_SIZE) break;
          page += 1;
        }
      }

      return new Output(
        true,
        ["Cron de leads ociosos processado"],
        [],
        { rules: rules.length, processedLeads, dispatched }
      );
    } catch (error) {
      console.error("[EvaluateIdleLeadsUseCase][evaluate] Erro:", error);
      return new Output(false, [], ["Erro ao avaliar leads ociosos"], null);
    }
  }

  private toThresholdMs(value: number, unit: "hours" | "days") {
    const hours = unit === "days" ? value * 24 : value;
    return hours * 60 * 60 * 1000;
  }
}

export const evaluateIdleLeadsUseCase = new EvaluateIdleLeadsUseCase();
