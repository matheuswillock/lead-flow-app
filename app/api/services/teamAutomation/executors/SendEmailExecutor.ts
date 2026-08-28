import { emailService } from "@/lib/services/EmailService";
import { interpolateAutomationTemplate } from "@/lib/team-automation/template";
import { PLATFORM_FROM_HEADER } from "@/lib/email/resolve-campaign-from";
import type {
  AutomationExecutionContext,
  AutomationExecutionResult,
  IAutomationActionExecutor,
} from "./IAutomationActionExecutor";

export class SendEmailExecutor implements IAutomationActionExecutor {
  readonly actionType = "send_email" as const;

  async execute(ctx: AutomationExecutionContext): Promise<AutomationExecutionResult> {
    const subjectTemplate = ctx.actionConfig.emailSubject?.trim();
    const bodyTemplate = ctx.actionConfig.emailBodyTemplate?.trim();

    if (!subjectTemplate || !bodyTemplate) {
      return { status: "skipped", errorMessage: "Assunto ou corpo do e-mail vazio" };
    }

    if (!ctx.lead.email?.trim()) {
      return { status: "skipped", errorMessage: "Lead sem e-mail" };
    }

    const subject = interpolateAutomationTemplate(subjectTemplate, ctx.lead);
    const html = interpolateAutomationTemplate(bodyTemplate, ctx.lead).replace(/\n/g, "<br/>");

    try {
      const result = await emailService.sendEmailUntracked({
        to: [ctx.lead.email],
        subject,
        html,
        from: PLATFORM_FROM_HEADER,
      });

      if (!result.success) {
        return {
          status: "failed",
          errorMessage: result.error ?? "Falha ao enviar e-mail",
        };
      }

      return {
        status: "success",
        payload: { actionType: this.actionType, leadName: ctx.lead.name },
      };
    } catch (error) {
      return {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Falha ao enviar e-mail",
      };
    }
  }
}
