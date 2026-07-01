import { Output } from "@/lib/output";
import { backofficeBotRepository } from "@/app/api/infra/data/repositories/backofficeBot/BackofficeBotRepository";
import { normalizePhoneE164, parseVincularCode } from "@/lib/studio-bot/phone";
import type { StudioBotInboundWebhookBody } from "@/lib/studio-bot/types";
import { backofficeBotAuthUseCase } from "./BackofficeBotAuthUseCase";
import type { IBackofficeBotInboundWebhookUseCase } from "./IBackofficeBotInboundWebhookUseCase";

export class BackofficeBotInboundWebhookUseCase implements IBackofficeBotInboundWebhookUseCase {
  async handleInbound(
    body: StudioBotInboundWebhookBody,
    idempotencyKey?: string | null
  ): Promise<Output> {
    try {
      const phone = normalizePhoneE164(body.normalizedPhone);
      if (!phone) {
        return new Output(false, [], ["Telefone inválido"], { errorCode: "PHONE_INVALID" });
      }

      const channel = await backofficeBotRepository.getActiveChannel();
      if (!channel) {
        return new Output(false, [], ["Canal não configurado"], { errorCode: "CHANNEL_NOT_CONFIGURED" });
      }

      const messageId = body.channelMessageId ?? idempotencyKey ?? null;
      if (messageId) {
        const existing = await backofficeBotRepository.findMessageByChannelMessageId(messageId);
        if (existing) {
          return new Output(true, [], [], {
            cached: true,
            messageId: existing.id,
          });
        }
      }

      const userLink = await backofficeBotRepository.findActiveUserLinkByPhone(phone);
      const message = await backofficeBotRepository.createMessage({
        channelId: channel.id,
        userLinkId: userLink?.id ?? null,
        direction: "inbound",
        channelMessageId: messageId,
        payload: body.payload,
      });

      if (userLink) {
        await backofficeBotRepository.touchUserLinkInteraction(userLink.id);
      }

      const text = body.payload.contentText?.trim() ?? "";
      const vincularCode = parseVincularCode(text);
      if (vincularCode) {
        const verifyOutput = await backofficeBotAuthUseCase.verifyCode(phone, vincularCode);
        return new Output(verifyOutput.isValid, verifyOutput.successMessages, verifyOutput.errorMessages, {
          messageId: message.id,
          auth: verifyOutput.result,
          flow: "verify_code",
        });
      }

      const authStatus = await backofficeBotAuthUseCase.getAuthStatus(phone);
      return new Output(true, [], [], {
        messageId: message.id,
        linked: authStatus.result?.linked ?? false,
        auth: authStatus.result,
        flow: userLink ? "session" : "auth_required",
      });
    } catch (error) {
      console.error("[BackofficeBotInboundWebhookUseCase][handleInbound]", error);
      return new Output(false, [], ["Erro ao processar mensagem inbound"], null);
    }
  }
}

export const backofficeBotInboundWebhookUseCase = new BackofficeBotInboundWebhookUseCase();
