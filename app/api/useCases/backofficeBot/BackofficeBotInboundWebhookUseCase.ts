import { Output } from "@/lib/output";
import { backofficeBotRepository } from "@/app/api/infra/data/repositories/backofficeBot/BackofficeBotRepository";
import { backofficeEvoApiService } from "@/app/api/services/backofficeBot/evo/BackofficeEvoApiService";
import {
  formatActionReply,
  formatDocumentPrompt,
  formatLeadSubmenu,
  formatMeetingDatetimePrompt,
  formatMeetingMenu,
  formatNotePrompt,
  formatPermissionDeniedMessage,
  formatSearchQueryPrompt,
  formatTaskPrompt,
} from "@/lib/studio-bot/format-bot-reply";
import { parseMeetingDatetimeInput } from "@/lib/studio-bot/parse-meeting-datetime";
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

const LEAD_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$/;

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

function looksLikeLeadCode(text: string): boolean {
  const trimmed = text.trim();
  if (!LEAD_CODE_PATTERN.test(trimmed)) return false;
  if (/^[1-6]$/.test(trimmed)) return false;
  return true;
}

function defaultFileNameForMime(mimeType: string, mediaFileName?: string | null): string {
  if (mediaFileName?.trim()) return mediaFileName.trim();
  if (mimeType.startsWith("image/")) {
    const ext = mimeType.split("/")[1]?.split(";")[0] || "jpg";
    return `whatsapp-image.${ext}`;
  }
  if (mimeType.includes("pdf")) return "whatsapp-documento.pdf";
  return "whatsapp-documento.bin";
}

function formatMainMenuMessage(title: string, items: Array<{ label: string }>): string {
  const lines = items.map((item, index) => `${index + 1} — ${item.label}`);
  return `${title}\nO que deseja fazer?\n\n${lines.join("\n")}`;
}

type OutboundBase = {
  channelId: string;
  channelDisplayName: string;
  phone: string;
  userLinkId: string;
};

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

      const channel = await backofficeBotRepository.findPrimaryChannel();
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

      const outboundBase: OutboundBase = {
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

      if (session?.flowStep === "awaiting_note_body" && session.currentLeadId && text.length > 0) {
        return this.runActionAndReply({
          ...outboundBase,
          messageId: message.id,
          userLinkId: userLink.id,
          teamId,
          action: "add_note",
          params: { leadId: session.currentLeadId, body: text },
          nextFlowStep: "lead_submenu",
          currentLeadId: session.currentLeadId,
        });
      }

      if (session?.flowStep === "awaiting_task_title" && session.currentLeadId && text.length > 0) {
        return this.runActionAndReply({
          ...outboundBase,
          messageId: message.id,
          userLinkId: userLink.id,
          teamId,
          action: "create_task",
          params: { leadId: session.currentLeadId, title: text, body: text },
          nextFlowStep: "lead_submenu",
          currentLeadId: session.currentLeadId,
        });
      }

      if (session?.flowStep === "awaiting_meeting_datetime" && session.currentLeadId && text.length > 0) {
        const parsed = parseMeetingDatetimeInput(text);
        if (!parsed) {
          await this.sendOutboundText({
            ...outboundBase,
            text: `Formato inválido.\n\n${formatMeetingDatetimePrompt()}`,
          });
          return new Output(true, [], [], {
            messageId: message.id,
            linked: true,
            flow: "awaiting_meeting_datetime_invalid",
          });
        }
        return this.runActionAndReply({
          ...outboundBase,
          messageId: message.id,
          userLinkId: userLink.id,
          teamId,
          action: "schedule_meeting",
          params: {
            leadId: session.currentLeadId,
            date: parsed.isoDate,
            ...(parsed.title ? { meetingTitle: parsed.title } : {}),
          },
          nextFlowStep: "lead_submenu",
          currentLeadId: session.currentLeadId,
        });
      }

      if (
        session?.flowStep === "awaiting_document" &&
        session.currentLeadId &&
        (body.payload.messageType === "image" || body.payload.messageType === "document")
      ) {
        const mediaKey = body.payload.mediaKey;
        if (!mediaKey || typeof mediaKey !== "object") {
          await this.sendOutboundText({
            ...outboundBase,
            text: `Não consegui baixar o arquivo. ${formatDocumentPrompt()}`,
          });
          return new Output(false, [], ["mediaKey ausente"], {
            messageId: message.id,
            flow: "awaiting_document_error",
          });
        }

        const instanceName = process.env.EVO_BETHANIA_INSTANCE?.trim() || "bethania";
        const media = await backofficeEvoApiService.getBase64FromMediaMessage({
          instanceName,
          messageKey: mediaKey,
        });
        if (!media?.base64) {
          await this.sendOutboundText({
            ...outboundBase,
            text: `Não consegui baixar o arquivo da Evolution. Tente novamente ou digite *menu*.`,
          });
          return new Output(false, [], ["Falha ao baixar mídia"], {
            messageId: message.id,
            flow: "awaiting_document_download_error",
          });
        }

        const fileName = defaultFileNameForMime(media.mimeType, body.payload.mediaFileName);
        const fileBase64 = media.base64.includes(",")
          ? media.base64.slice(media.base64.indexOf(",") + 1)
          : media.base64;
        return this.runActionAndReply({
          ...outboundBase,
          messageId: message.id,
          userLinkId: userLink.id,
          teamId,
          action: "upload_attachment",
          params: {
            leadId: session.currentLeadId,
            fileBase64,
            fileName,
            mimeType: media.mimeType,
          },
          nextFlowStep: "lead_submenu",
          currentLeadId: session.currentLeadId,
        });
      }

      if (session?.flowStep === "awaiting_document" && session.currentLeadId && text.length > 0) {
        await this.sendOutboundText({
          ...outboundBase,
          text: formatDocumentPrompt(),
        });
        return new Output(true, [], [], {
          messageId: message.id,
          linked: true,
          flow: "awaiting_document_hint",
        });
      }

      if (session?.flowStep === "lead_meeting_menu" && session.currentLeadId) {
        const meetingChoice = normalizeCommandText(text);
        if (meetingChoice === "1" || meetingChoice === "agendar" || meetingChoice === "agendar reuniao") {
          if (!teamId) {
            await this.sendOutboundText({
              ...outboundBase,
              text: "Não encontrei o time ativo. Digite *menu* e tente novamente.",
            });
            return new Output(false, [], ["Time ativo não encontrado"], {
              messageId: message.id,
              flow: "meeting_prompt_error",
            });
          }
          await backofficeBotRepository.upsertSession({
            userLinkId: userLink.id,
            teamId,
            currentLeadId: session.currentLeadId,
            flowId: "lead_context",
            flowStep: "awaiting_meeting_datetime",
            expiresAt: new Date(Date.now() + SESSION_TTL_MS),
          });
          await this.sendOutboundText({
            ...outboundBase,
            text: formatMeetingDatetimePrompt(),
          });
          return new Output(true, [], [], {
            messageId: message.id,
            linked: true,
            flow: "awaiting_meeting_datetime",
          });
        }
        if (meetingChoice === "2" || meetingChoice === "cancelar reuniao") {
          return this.runActionAndReply({
            ...outboundBase,
            messageId: message.id,
            userLinkId: userLink.id,
            teamId,
            action: "cancel_meeting",
            params: { leadId: session.currentLeadId },
            nextFlowStep: "lead_submenu",
            currentLeadId: session.currentLeadId,
          });
        }
        if (meetingChoice === "6" || meetingChoice === "voltar") {
          return this.openLeadById({
            ...outboundBase,
            messageId: message.id,
            userLinkId: userLink.id,
            teamId,
            leadId: session.currentLeadId,
          });
        }
        await this.sendOutboundText({
          ...outboundBase,
          text: formatMeetingMenu(),
        });
        return new Output(true, [], [], {
          messageId: message.id,
          linked: true,
          flow: "lead_meeting_menu",
        });
      }

      if (session?.flowStep === "lead_submenu" && session.currentLeadId) {
        const submenuChoice = normalizeCommandText(text);
        if (submenuChoice === "1" || submenuChoice === "detalhes" || submenuChoice === "ver detalhes") {
          return this.openLeadById({
            ...outboundBase,
            messageId: message.id,
            userLinkId: userLink.id,
            teamId,
            leadId: session.currentLeadId,
          });
        }
        if (submenuChoice === "2" || submenuChoice === "nota" || submenuChoice === "adicionar nota") {
          if (!teamId) {
            await this.sendOutboundText({
              ...outboundBase,
              text: "Não encontrei o time ativo. Digite *menu* e tente novamente.",
            });
            return new Output(false, [], ["Time ativo não encontrado"], {
              messageId: message.id,
              flow: "note_prompt_error",
            });
          }
          await backofficeBotRepository.upsertSession({
            userLinkId: userLink.id,
            teamId,
            currentLeadId: session.currentLeadId,
            flowId: "lead_context",
            flowStep: "awaiting_note_body",
            expiresAt: new Date(Date.now() + SESSION_TTL_MS),
          });
          await this.sendOutboundText({
            ...outboundBase,
            text: formatNotePrompt(),
          });
          return new Output(true, [], [], {
            messageId: message.id,
            linked: true,
            flow: "awaiting_note_body",
          });
        }
        if (submenuChoice === "3" || submenuChoice === "reuniao" || submenuChoice === "reunião") {
          if (!teamId) {
            await this.sendOutboundText({
              ...outboundBase,
              text: "Não encontrei o time ativo. Digite *menu* e tente novamente.",
            });
            return new Output(false, [], ["Time ativo não encontrado"], {
              messageId: message.id,
              flow: "meeting_menu_error",
            });
          }
          await backofficeBotRepository.upsertSession({
            userLinkId: userLink.id,
            teamId,
            currentLeadId: session.currentLeadId,
            flowId: "lead_context",
            flowStep: "lead_meeting_menu",
            expiresAt: new Date(Date.now() + SESSION_TTL_MS),
          });
          await this.sendOutboundText({
            ...outboundBase,
            text: formatMeetingMenu(),
          });
          return new Output(true, [], [], {
            messageId: message.id,
            linked: true,
            flow: "lead_meeting_menu",
          });
        }
        if (submenuChoice === "4" || submenuChoice === "tarefa" || submenuChoice === "nova tarefa") {
          if (!teamId) {
            await this.sendOutboundText({
              ...outboundBase,
              text: "Não encontrei o time ativo. Digite *menu* e tente novamente.",
            });
            return new Output(false, [], ["Time ativo não encontrado"], {
              messageId: message.id,
              flow: "task_prompt_error",
            });
          }
          await backofficeBotRepository.upsertSession({
            userLinkId: userLink.id,
            teamId,
            currentLeadId: session.currentLeadId,
            flowId: "lead_context",
            flowStep: "awaiting_task_title",
            expiresAt: new Date(Date.now() + SESSION_TTL_MS),
          });
          await this.sendOutboundText({
            ...outboundBase,
            text: formatTaskPrompt(),
          });
          return new Output(true, [], [], {
            messageId: message.id,
            linked: true,
            flow: "awaiting_task_title",
          });
        }
        if (submenuChoice === "5" || submenuChoice === "documento" || submenuChoice === "anexo") {
          if (!teamId) {
            await this.sendOutboundText({
              ...outboundBase,
              text: "Não encontrei o time ativo. Digite *menu* e tente novamente.",
            });
            return new Output(false, [], ["Time ativo não encontrado"], {
              messageId: message.id,
              flow: "document_prompt_error",
            });
          }
          await backofficeBotRepository.upsertSession({
            userLinkId: userLink.id,
            teamId,
            currentLeadId: session.currentLeadId,
            flowId: "lead_context",
            flowStep: "awaiting_document",
            expiresAt: new Date(Date.now() + SESSION_TTL_MS),
          });
          await this.sendOutboundText({
            ...outboundBase,
            text: formatDocumentPrompt(),
          });
          return new Output(true, [], [], {
            messageId: message.id,
            linked: true,
            flow: "awaiting_document",
          });
        }
        if (submenuChoice === "6") {
          return this.openMainMenu({
            ...outboundBase,
            messageId: message.id,
            userLinkId: userLink.id,
            profileId: userLink.profileId,
          });
        }
        if (looksLikeLeadCode(text)) {
          return this.openLeadByCode({
            ...outboundBase,
            messageId: message.id,
            userLinkId: userLink.id,
            teamId,
            leadCode: text.trim(),
          });
        }
      }

      if (
        (session?.flowStep === "list_shown" || session?.flowStep === "awaiting_choice") &&
        looksLikeLeadCode(text)
      ) {
        return this.openLeadByCode({
          ...outboundBase,
          messageId: message.id,
          userLinkId: userLink.id,
          teamId,
          leadCode: text.trim(),
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
        currentLeadId: null,
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

  private async openLeadByCode(input: {
    channelId: string;
    channelDisplayName: string;
    phone: string;
    userLinkId: string;
    messageId: string;
    teamId: string | null;
    leadCode: string;
  }): Promise<Output> {
    return this.runActionAndReply({
      channelId: input.channelId,
      channelDisplayName: input.channelDisplayName,
      phone: input.phone,
      userLinkId: input.userLinkId,
      messageId: input.messageId,
      teamId: input.teamId,
      action: "lead_detail",
      params: { leadCode: input.leadCode },
      nextFlowStep: "lead_submenu",
      captureLeadIdFromResult: true,
    });
  }

  private async openLeadById(input: {
    channelId: string;
    channelDisplayName: string;
    phone: string;
    userLinkId: string;
    messageId: string;
    teamId: string | null;
    leadId: string;
  }): Promise<Output> {
    return this.runActionAndReply({
      channelId: input.channelId,
      channelDisplayName: input.channelDisplayName,
      phone: input.phone,
      userLinkId: input.userLinkId,
      messageId: input.messageId,
      teamId: input.teamId,
      action: "lead_detail",
      params: { leadId: input.leadId },
      nextFlowStep: "lead_submenu",
      currentLeadId: input.leadId,
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
    currentLeadId?: string | null;
    captureLeadIdFromResult?: boolean;
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
      flowId: input.nextFlowStep === "lead_submenu" ? "lead_context" : "menu_main",
    });

    let replyText = actionOutput.isValid
      ? formatActionReply(input.action, actionOutput.result)
      : formatActionReply(input.action, null, actionOutput.errorMessages);

    if (actionOutput.isValid && input.action === "lead_detail") {
      const lead = (actionOutput.result as { lead?: Parameters<typeof formatLeadSubmenu>[0] })?.lead;
      if (lead) {
        replyText = formatActionReply("lead_detail", actionOutput.result);
      }
    }

    await this.sendOutboundText({
      channelId: input.channelId,
      channelDisplayName: input.channelDisplayName,
      phone: input.phone,
      userLinkId: input.userLinkId,
      text: replyText,
    });

    if (actionOutput.isValid) {
      let currentLeadId = input.currentLeadId ?? null;
      if (input.captureLeadIdFromResult) {
        const lead = (actionOutput.result as { lead?: { id?: string } } | null)?.lead;
        currentLeadId = lead?.id ?? null;
      }

      await backofficeBotRepository.upsertSession({
        userLinkId: input.userLinkId,
        teamId: input.teamId,
        currentLeadId,
        flowId: currentLeadId ? "lead_context" : "menu_main",
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
