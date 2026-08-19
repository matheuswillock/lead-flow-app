import type {
  ISlackEmailCreditsService,
  SlackEmailCreditsPayload,
} from "./ISlackEmailCreditsService";

const CREDIT_PLAN_INFO: Record<string, { label: string; value: string }> = {
  "25k": { label: "25 mil disparos/mês", value: "R$ 375/mês" },
  "50k": { label: "50 mil disparos/mês", value: "R$ 650/mês" },
};

function escapeSlackMrkdwn(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export class SlackEmailCreditsService implements ISlackEmailCreditsService {
  async notify(payload: SlackEmailCreditsPayload): Promise<{ success: boolean; error?: string }> {
    try {
      const webhookUrl = process.env.SLACK_EMAIL_CREDITS_WEBHOOK_URL;

      if (!webhookUrl) {
        console.warn("[SlackEmailCreditsService] SLACK_EMAIL_CREDITS_WEBHOOK_URL não configurado — skip");
        return { success: true };
      }

      const planInfo = CREDIT_PLAN_INFO[payload.plan] ?? { label: payload.plan, value: "" };
      const safeEmail = escapeSlackMrkdwn(payload.email.trim());

      const blocks: Record<string, unknown>[] = [
        {
          type: "header",
          text: { type: "plain_text", text: "Novo interesse em créditos de e-mail", emoji: true },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*E-mail:*\n${safeEmail}` },
            { type: "mrkdwn", text: `*Plano:*\n${planInfo.label}` },
            { type: "mrkdwn", text: `*Valor:*\n${planInfo.value}` },
          ],
        },
        {
          type: "context",
          elements: [{ type: "mrkdwn", text: `Profile ID: \`${payload.profileId}\`` }],
        },
      ];

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `Novo interesse em créditos de e-mail: ${payload.email} — ${planInfo.label} (${planInfo.value})`,
          blocks,
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        console.error("[SlackEmailCreditsService] Slack webhook retornou erro:", {
          status: response.status,
          body,
        });
        return { success: false, error: "Falha ao notificar Slack" };
      }

      return { success: true };
    } catch (error) {
      console.error("[SlackEmailCreditsService] Erro ao notificar Slack:", error);
      return { success: false, error: "Erro interno ao notificar Slack" };
    }
  }
}

export const slackEmailCreditsService = new SlackEmailCreditsService();
