import { Output } from "@/lib/output";
import { backofficeBotRepository } from "@/app/api/infra/data/repositories/backofficeBot/BackofficeBotRepository";
import { backofficeEvoApiService } from "@/app/api/services/backofficeBot/evo/BackofficeEvoApiService";
import {
  formatActionReply,
  formatPermissionDeniedMessage,
  formatSearchQueryPrompt,
} from "@/lib/studio-bot/format-bot-reply";
import { normalizePhoneE164, parseVincularCode } from "@/lib/studio-bot/phone";
import type { StudioBotInboundWebhookBody } from "@/lib/studio-bot/types";
import { backofficeBotActionUseCase } from "./BackofficeBotActionUseCase";
import { backofficeBotAuthUseCase } from "./BackofficeBotAuthUseCase";
import { backofficeBotContextUseCase } from "./BackofficeBotContextUseCase";
import type { IBackofficeBotInboundWebhookUseCase } from "./IBackofficeBotInboundWebhookUseCase";

const AUTH_REQUIRED_MESSAGE =
  "Para usar a Bethânia, vincule seu WhatsApp em *Minha conta → Conexões* no Corretor Studio e envie `VINCULAR` + o código.";

const UNKNOWN_COMMAND_MESSAGE =
  "Não entendi esse comando. Digite *menu* para ver as opções disponíveis.";

const SESSION_TTL_MS = 30 * 60 * 1000;

const CHOICE_TO_ACTION: Record<string, string> = {
  "1": "list_leads",
  "2": "agenda_today",
  "3": "list_tasks",
  "4": "search_lead",
  "5": "team_digest",
};

const MANAGER_ONLY_ACTIONS = new Set(["search_lead", "team_digest"]);

function normalizeCommandText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase();
}

function isMenuCommand(text: string): boolean {
  const normalized = normalizeCommandText(text);
  return (
    normalized === "menu" ||
    normalized === "oi" ||
    normalized === "ola" ||
    normalized === "olá" ||
    normalized === "inicio" ||
    normalized === "início" ||
    normalized === "start" ||
    normalized === "ajuda" ||
    normalized === "help"
  );
}

function isResetCommand(text: string): boolean {
  const normalized = normalizeCommandText(text);
  return (
    isMenuCommand(text) ||
    normalized === "voltar" ||
    normalized === "cancelar" ||
    normalized === "cancela"
  );
}

function parseMenuChoice(text: string): string | null {
  const normalized = normalizeCommandText(text);
  if (CHOICE_TO_ACTION[normalized]) {
    return normalized;
  }

  const labelMap: Record<string, string> = {
    "meus leads": "1",
    leads: "1",
    "agenda de hoje": "2",
    agenda: "2",
    "minhas tarefas": "3",
    tarefas: "3",
    "buscar lead": "4",
    buscar: "4",
    busca: "4",
    "resumo do time": "5",
    resumo: "5",
    digest: "5",
  };

  return labelMap[normalized] ?? null;
}

function formatMainMenuMessage(title: string, items: Array<{ label: string }>): string {
  const lines = items.map((item, index) => `${index + 1} — ${item.label}`);
  return `${title}\nO que deseja fazer?\n\n${lines.join("\n")}`;
}

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

      if (!userLink) {
        await this.sendOutboundText({
          channelId: channel.id,
          channelDisplayName: channel.displayName,
          phone,
          userLinkId: null,
          text: AUTH_REQUIRED_MESSAGE,
        });
        return new Output(true, [], [], {
          messageId: message.id,
          linked: false,
          flow: "auth_required",
        });
      }

      const outboundBase = {
        channelId: channel.id,
        channelDisplayName: channel.displayName,
        phone,
        userLinkId: userLink.id,
      };

      if (isResetCommand(text)) {
        return this.openMainMenu({
          ...outboundBase,
          messageId: message.id,
          userLinkId: userLink.id,
          profileId: userLink.profileId,
        });
      }

      const session = await backofficeBotRepository.findActiveSession(userLink.id);
      const teamId =
        session?.teamId ??
        (await backofficeBotRepository.findProfileActiveTeam(userLink.profileId))?.activeTeamId ??
        null;

      if (session?.flowStep === "awaiting_search_query" && text.length > 0) {
        return this.runActionAndReply({
          ...outboundBase,
          messageId: message.id,
          userLinkId: userLink.id,
          teamId,
          action: "search_lead",
          params: { query: text },
          nextFlowStep: "list_shown",
        });
      }

      if (session?.flowStep === "awaiting_choice") {
        const choice = parseMenuChoice(text);
        if (choice) {
          const action = CHOICE_TO_ACTION[choice];
          if (!action) {
            await this.sendOutboundText({ ...outboundBase, text: UNKNOWN_COMMAND_MESSAGE });
            return new Output(true, [], [], {
              messageId: message.id,
              linked: true,
              flow: "unknown_command",
            });
          }

          if (MANAGER_ONLY_ACTIONS.has(action)) {
            const contextOutput = await backofficeBotContextUseCase.getContext({
              userLinkId: userLink.id,
              teamId,
            });
            const canAccess = Boolean(contextOutput.result?.canViewTeamDigest);
            if (!canAccess) {
              await this.sendOutboundText({
                ...outboundBase,
                text: formatPermissionDeniedMessage(),
              });
              return new Output(true, [], [], {
                messageId: message.id,
                linked: true,
                flow: "permission_denied",
                action,
              });
            }
          }

          if (action === "search_lead") {
            if (!teamId) {
              await this.sendOutboundText({
                ...outboundBase,
                text: "Não encontrei o time ativo. Digite *menu* e tente novamente.",
              });
              return new Output(false, [], ["Time ativo não encontrado"], {
                messageId: message.id,
                flow: "search_query_prompt_error",
              });
            }

            await backofficeBotRepository.upsertSession({
              userLinkId: userLink.id,
              teamId,
              flowId: "menu_main",
              flowStep: "awaiting_search_query",
              expiresAt: new Date(Date.now() + SESSION_TTL_MS),
            });
            await this.sendOutboundText({
              ...outboundBase,
              text: formatSearchQueryPrompt(),
            });
            return new Output(true, [], [], {
              messageId: message.id,
              linked: true,
              flow: "awaiting_search_query",
            });
          }

          return this.runActionAndReply({
            ...outboundBase,
            messageId: message.id,
            userLinkId: userLink.id,
            teamId,
            action,
            nextFlowStep: "list_shown",
          });
        }
      }

      await this.sendOutboundText({
        ...outboundBase,
        text: UNKNOWN_COMMAND_MESSAGE,
      });

      return new Output(true, [], [], {
        messageId: message.id,
        linked: true,
        flow: "unknown_command",
      });
    } catch (error) {
      console.error("[BackofficeBotInboundWebhookUseCase][handleInbound]", error);
      return new Output(false, [], ["Erro ao processar mensagem inbound"], null);
    }
  }

  private async openMainMenu(input: {
    channelId: string;
    channelDisplayName: string;
    phone: string;
    userLinkId: string;
    profileId: string;
    messageId: string;
  }): Promise<Output> {
    const contextOutput = await backofficeBotContextUseCase.getContext({
      userLinkId: input.userLinkId,
    });
    if (!contextOutput.isValid || !contextOutput.result?.menu) {
      await this.sendOutboundText({
        channelId: input.channelId,
        channelDisplayName: input.channelDisplayName,
        phone: input.phone,
        userLinkId: input.userLinkId,
        text: "Não consegui montar o menu agora. Tente novamente em instantes.",
      });
      return new Output(false, [], contextOutput.errorMessages, {
        messageId: input.messageId,
        flow: "menu_error",
      });
    }

    const menu = contextOutput.result.menu as {
      title: string;
      items: Array<{ label: string }>;
    };
    const menuText = formatMainMenuMessage(menu.title, menu.items);
    await this.sendOutboundText({
      channelId: input.channelId,
      channelDisplayName: input.channelDisplayName,
      phone: input.phone,
      userLinkId: input.userLinkId,
      text: menuText,
    });

    const profile = await backofficeBotRepository.findProfileActiveTeam(input.profileId);
    if (profile?.activeTeamId) {
      await backofficeBotRepository.upsertSession({
        userLinkId: input.userLinkId,
        teamId: profile.activeTeamId,
        flowId: "menu_main",
        flowStep: "awaiting_choice",
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      });
    }

    return new Output(true, [], [], {
      messageId: input.messageId,
      linked: true,
      flow: "menu_main",
      menu,
    });
  }

  private async runActionAndReply(input: {
    channelId: string;
    channelDisplayName: string;
    phone: string;
    userLinkId: string;
    messageId: string;
    teamId: string | null;
    action: string;
    params?: Record<string, unknown>;
    nextFlowStep: string;
  }): Promise<Output> {
    if (!input.teamId) {
      await this.sendOutboundText({
        channelId: input.channelId,
        channelDisplayName: input.channelDisplayName,
        phone: input.phone,
        userLinkId: input.userLinkId,
        text: "Não encontrei o time ativo. Digite *menu* e tente novamente.",
      });
      return new Output(false, [], ["Time ativo não encontrado"], {
        messageId: input.messageId,
        flow: "action_error",
        action: input.action,
      });
    }

    const actionOutput = await backofficeBotActionUseCase.executeAction(input.action, {
      userLinkId: input.userLinkId,
      teamId: input.teamId,
      params: input.params,
      flowId: "menu_main",
    });

    const replyText = actionOutput.isValid
      ? formatActionReply(input.action, actionOutput.result)
      : formatActionReply(input.action, null, actionOutput.errorMessages);

    await this.sendOutboundText({
      channelId: input.channelId,
      channelDisplayName: input.channelDisplayName,
      phone: input.phone,
      userLinkId: input.userLinkId,
      text: replyText,
    });

    if (actionOutput.isValid) {
      await backofficeBotRepository.upsertSession({
        userLinkId: input.userLinkId,
        teamId: input.teamId,
        flowId: "menu_main",
        flowStep: input.nextFlowStep,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      });
    }

    return new Output(actionOutput.isValid, actionOutput.successMessages, actionOutput.errorMessages, {
      messageId: input.messageId,
      linked: true,
      flow: input.action,
      actionResult: actionOutput.result,
    });
  }

  private async sendOutboundText(input: {
    channelId: string;
    channelDisplayName: string;
    phone: string;
    userLinkId: string | null;
    text: string;
  }): Promise<void> {
    try {
      const instanceName = process.env.EVO_BETHANIA_INSTANCE?.trim() || "bethania";
      await backofficeEvoApiService.sendTextMessage({
        instanceName,
        number: input.phone,
        text: input.text,
      });

      await backofficeBotRepository.createMessage({
        channelId: input.channelId,
        userLinkId: input.userLinkId,
        direction: "outbound",
        payload: {
          messageType: "text",
          contentText: input.text,
          mediaUrl: null,
          caption: null,
          mediaFileName: null,
          linkPreview: null,
          pushName: input.channelDisplayName,
        },
      });
    } catch (error) {
      console.error("[BackofficeBotInboundWebhookUseCase][sendOutboundText]", error);
    }
  }
}

export const backofficeBotInboundWebhookUseCase = new BackofficeBotInboundWebhookUseCase();
