import { prisma } from "@/app/api/infra/data/prisma";
import { EvolutionWhatsAppProvider } from "@/app/api/services/whatsapp/provider/EvolutionWhatsAppProvider";
import { normalizePhone } from "@/lib/whatsapp/normalize-phone";
import { interpolateAutomationTemplate } from "@/lib/team-automation/template";
import type {
  AutomationExecutionContext,
  AutomationExecutionResult,
  IAutomationActionExecutor,
} from "./IAutomationActionExecutor";

export class SendWhatsAppMessageExecutor implements IAutomationActionExecutor {
  readonly actionType = "send_whatsapp_message" as const;

  constructor(private readonly provider = new EvolutionWhatsAppProvider()) {}

  async execute(ctx: AutomationExecutionContext): Promise<AutomationExecutionResult> {
    const template = ctx.actionConfig.messageTemplate?.trim();
    if (!template) {
      return { status: "skipped", errorMessage: "Template de mensagem vazio" };
    }

    if (!ctx.lead.phone?.trim()) {
      return { status: "skipped", errorMessage: "Lead sem telefone" };
    }

    const config = await prisma.teamWhatsAppConfig.findUnique({
      where: { teamId: ctx.lead.teamId },
      select: { instanceName: true, status: true },
    });

    if (!config?.instanceName || config.status !== "CONNECTED") {
      return { status: "skipped", errorMessage: "WhatsApp não conectado para este time" };
    }

    const text = interpolateAutomationTemplate(template, ctx.lead);
    const phone = normalizePhone(ctx.lead.phone);
    const recipientJid = `${phone}@s.whatsapp.net`;

    try {
      await this.provider.sendText({
        instanceName: config.instanceName,
        recipientJid,
        text,
      });
      return {
        status: "success",
        payload: { actionType: this.actionType, leadName: ctx.lead.name },
      };
    } catch (error) {
      return {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Falha ao enviar WhatsApp",
      };
    }
  }
}
