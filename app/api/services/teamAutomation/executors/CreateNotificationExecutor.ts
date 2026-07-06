import { NotificationType } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import { notificationService } from "@/app/api/services/notifications/NotificationService";
import { interpolateAutomationTemplate } from "@/lib/team-automation/template";
import type {
  AutomationExecutionContext,
  AutomationExecutionResult,
  IAutomationActionExecutor,
} from "./IAutomationActionExecutor";

export class CreateNotificationExecutor implements IAutomationActionExecutor {
  readonly actionType = "create_notification" as const;

  async execute(ctx: AutomationExecutionContext): Promise<AutomationExecutionResult> {
    const template = ctx.actionConfig.messageTemplate?.trim();
    if (!template) {
      return { status: "skipped", errorMessage: "Template de notificação vazio" };
    }

    const configuredIds = ctx.actionConfig.notifyProfileIds ?? [];
    const recipientIds = configuredIds.length > 0
      ? configuredIds
      : ctx.lead.assignedTo
        ? [ctx.lead.assignedTo]
        : [];

    if (recipientIds.length === 0) {
      return { status: "skipped", errorMessage: "Nenhum destinatário para notificação" };
    }

    const members = await prisma.teamMember.findMany({
      where: {
        teamId: ctx.lead.teamId,
        profileId: { in: recipientIds },
        isActive: true,
      },
      select: { profileId: true },
    });

    const validRecipientIds = members.map((m) => m.profileId);
    if (validRecipientIds.length === 0) {
      return { status: "skipped", errorMessage: "Destinatários inválidos para o time" };
    }

    const message = interpolateAutomationTemplate(template, ctx.lead);

    try {
      for (const recipientProfileId of validRecipientIds) {
        await notificationService.createSystemNotification({
          recipientProfileId,
          teamId: ctx.lead.teamId,
          type: NotificationType.AUTOMATION_RULE,
          message,
          metadata: {
            event: "AUTOMATION_RULE",
            leadId: ctx.lead.id,
            leadCode: ctx.lead.leadCode,
            leadName: ctx.lead.name,
            ruleId: ctx.rule.id,
            ruleName: ctx.rule.name,
          },
        });
      }

      return {
        status: "success",
        payload: {
          actionType: this.actionType,
          leadName: ctx.lead.name,
          recipientCount: validRecipientIds.length,
        },
      };
    } catch (error) {
      return {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Falha ao criar notificação",
      };
    }
  }
}
