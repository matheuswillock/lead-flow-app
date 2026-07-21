import { ActivityType } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import type {
  AutomationExecutionContext,
  AutomationExecutionResult,
  IAutomationActionExecutor,
} from "./IAutomationActionExecutor";

export class AssignOperatorExecutor implements IAutomationActionExecutor {
  readonly actionType = "assign_operator" as const;

  async execute(ctx: AutomationExecutionContext): Promise<AutomationExecutionResult> {
    const strategy = ctx.actionConfig.assignStrategy ?? "round_robin";
    let targetProfileId = ctx.actionConfig.operatorProfileId ?? null;

    const activeMembers = await prisma.teamMember.findMany({
      where: { teamId: ctx.lead.teamId },
      select: { profileId: true, role: true },
      orderBy: { createdAt: "asc" },
    });

    const eligible = activeMembers.filter((m) =>
      ["operator", "sdr", "closer", "manager"].includes(m.role)
    );

    if (eligible.length === 0) {
      return { status: "skipped", errorMessage: "Nenhum operador ativo no time" };
    }

    if (strategy === "specific_operator") {
      if (!targetProfileId || !eligible.some((m) => m.profileId === targetProfileId)) {
        return { status: "skipped", errorMessage: "Operador específico inválido ou inativo" };
      }
    } else {
      const next = eligible.find((m) => m.profileId !== ctx.lead.assignedTo) ?? eligible[0];
      targetProfileId = next.profileId;
    }

    if (!targetProfileId || targetProfileId === ctx.lead.assignedTo) {
      return { status: "skipped", errorMessage: "Lead já atribuído ao operador alvo" };
    }

    try {
      await prisma.lead.update({
        where: { id: ctx.lead.id },
        data: { assignedTo: targetProfileId },
      });

      await prisma.leadActivity.create({
        data: {
          leadId: ctx.lead.id,
          type: ActivityType.note,
          body: `Atribuição automática via regra "${ctx.rule.name}"`,
          payload: {
            kind: "automation_assign",
            ruleId: ctx.rule.id,
            assignedTo: targetProfileId,
          },
        },
      });

      return {
        status: "success",
        payload: { actionType: this.actionType, leadName: ctx.lead.name },
      };
    } catch (error) {
      return {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Falha ao atribuir operador",
      };
    }
  }
}
