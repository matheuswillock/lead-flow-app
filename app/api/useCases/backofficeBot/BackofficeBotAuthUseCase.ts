import { NotificationType, type BackofficeBotChannelStatus } from "@prisma/client";
import { Output } from "@/lib/output";
import { backofficeBotAuthService } from "@/app/api/services/backofficeBot/BackofficeBotAuthService";
import { backofficeEvoApiService } from "@/app/api/services/backofficeBot/evo/BackofficeEvoApiService";
import { notificationService } from "@/app/api/services/notifications/NotificationService";
import { backofficeBotRepository } from "@/app/api/infra/data/repositories/backofficeBot/BackofficeBotRepository";
import { buildBethaniaAuthCodeEmail } from "@/lib/emails/buildBethaniaAuthCodeEmail";
import { getEmailService } from "@/lib/services/EmailService";
import { buildBethaniaLinkErrorResult } from "@/lib/studio-bot/bethania-link-errors";
import type { IBackofficeBotAuthUseCase } from "./IBackofficeBotAuthUseCase";

const LINK_CONFIRMED_WHATSAPP_MESSAGE =
  "✅ Vinculação concluída com sucesso!\n\nSeu WhatsApp está conectado à Bethânia no Corretor Studio. Digite *menu* para ver o que posso fazer por você.";

const CHANNEL_AUTH_CODE_NOTIFICATION =
  "Seu código de verificação da Bethânia: **{code}**. Válido por 10 minutos. Informe na conversa com a Bethânia.";

function mapEvoStatusToChannelStatus(
  evoStatus: "open" | "close" | "connecting"
): BackofficeBotChannelStatus {
  if (evoStatus === "open") {
    return "connected";
  }
  if (evoStatus === "close") {
    return "disconnected";
  }
  return "pending";
}

/** TTL do sync Evolution no poll de linkStatus (BethaniaConnectionCard a cada 3s). */
const CHANNEL_SYNC_TTL_MS = 15_000;

type SyncedChannel = Awaited<ReturnType<typeof backofficeBotRepository.findPrimaryChannel>>;

let lastChannelSyncAtMs = 0;
let channelSyncInFlight: Promise<SyncedChannel> | null = null;

/** Só para testes — zera TTL/in-flight do sync Evolution. */
export function resetBethaniaChannelSyncCacheForTests() {
  lastChannelSyncAtMs = 0;
  channelSyncInFlight = null;
}

function mapAuthError(error: string): string {
  switch (error) {
    case "PHONE_INVALID":
      return "Número de telefone inválido";
    case "RATE_LIMIT":
      return "Limite de geração de código atingido. Tente novamente mais tarde.";
    case "AUTH_EXPIRED_OTP":
      return "Código expirado ou inválido";
    case "AUTH_INVALID_CODE":
      return "Código incorreto";
    case "PHONE_ALREADY_LINKED":
      return "Este número já está vinculado a outra conta";
    case "PHONE_MISMATCH":
      return "O WhatsApp que enviou o código não é o mesmo número cadastrado na conta";
    case "PROFILE_PHONE_REQUIRED":
      return "Cadastre um telefone na Account antes de vincular a Bethânia";
    case "BOT_UNAVAILABLE":
      return "A Bethânia está temporariamente desabilitada. Tente novamente mais tarde.";
    case "PROFILE_NOT_FOUND":
      return "Perfil não encontrado";
    case "TEAM_NOT_FOUND":
      return "Time ativo não encontrado";
    case "NOT_LINKED":
      return "Nenhum vínculo ativo encontrado";
    default:
      return "Não foi possível concluir a operação";
  }
}

export class BackofficeBotAuthUseCase implements IBackofficeBotAuthUseCase {
  async requestCode(email: string, normalizedPhone: string): Promise<Output> {
    try {
      const result = await backofficeBotAuthService.requestCode(email, normalizedPhone);
      if (!result.ok) {
        return new Output(false, [], [mapAuthError(result.error)], null);
      }

      if ("code" in result.result && result.result.code && result.result.profileId && result.result.challengeId) {
        await this.deliverChannelAuthCode({
          code: result.result.code,
          challengeId: result.result.challengeId,
          expiresAt: result.result.expiresAt ?? new Date().toISOString(),
          profileId: result.result.profileId,
          profileEmail: result.result.profileEmail ?? email,
          profileFullName: result.result.profileFullName ?? null,
          activeTeamId: result.result.activeTeamId ?? null,
        });
      }

      return new Output(true, [], [], {
        challengeId: result.result.challengeId,
        expiresAt: result.result.expiresAt,
      });
    } catch (error) {
      console.error("[BackofficeBotAuthUseCase][requestCode]", error);
      return new Output(false, [], ["Erro ao solicitar código"], null);
    }
  }

  private async deliverChannelAuthCode(input: {
    code: string;
    challengeId: string;
    expiresAt: string;
    profileId: string;
    profileEmail: string;
    profileFullName: string | null;
    activeTeamId: string | null;
  }): Promise<void> {
    const message = CHANNEL_AUTH_CODE_NOTIFICATION.replace("{code}", input.code);

    if (input.activeTeamId) {
      try {
        await notificationService.createSystemNotification({
          recipientProfileId: input.profileId,
          teamId: input.activeTeamId,
          type: NotificationType.BETHANIA_AUTH_CODE,
          message,
          metadata: {
            challengeId: input.challengeId,
            source: "channel_email",
            expiresAt: input.expiresAt,
          },
        });
      } catch (error) {
        console.error("[BackofficeBotAuthUseCase][deliverChannelAuthCode][notification]", error);
      }
    } else {
      console.info(
        "[BackofficeBotAuthUseCase][deliverChannelAuthCode] Sem time ativo — notificação in-app omitida",
        input.profileId
      );
    }

    try {
      const emailService = getEmailService();
      const userName = input.profileFullName?.trim() || input.profileEmail;
      await emailService.sendEmailUntracked({
        to: [input.profileEmail],
        subject: "Bethânia — seu código de verificação",
        html: buildBethaniaAuthCodeEmail({ userName, code: input.code }),
        idempotencyKey: `bethania-auth-code:${input.challengeId}`,
      });
    } catch (error) {
      console.error("[BackofficeBotAuthUseCase][deliverChannelAuthCode][email]", error);
    }
  }

  async verifyCode(normalizedPhone: string, code: string): Promise<Output> {
    try {
      const result = await backofficeBotAuthService.verifyCode(normalizedPhone, code);
      if (!result.ok) {
        const linkError = buildBethaniaLinkErrorResult(result.error);
        console.error("[BackofficeBotAuthUseCase][verifyCode]", {
          correlationId: linkError.correlationId,
          errorCode: linkError.errorCode,
          serviceError: result.error,
        });
        return new Output(false, [], [mapAuthError(result.error)], linkError);
      }

      await this.notifyLinkConfirmed(normalizedPhone, result.result.userLinkId);

      return new Output(true, ["Vínculo confirmado"], [], result.result);
    } catch (error) {
      const linkError = buildBethaniaLinkErrorResult(null, { isInternal: true });
      console.error("[BackofficeBotAuthUseCase][verifyCode]", {
        correlationId: linkError.correlationId,
        errorCode: linkError.errorCode,
        error,
      });
      return new Output(false, [], ["Erro ao verificar código"], linkError);
    }
  }

  private async notifyLinkConfirmed(normalizedPhone: string, userLinkId: string): Promise<void> {
    try {
      const channel = await backofficeBotRepository.findPrimaryChannel();
      const instanceName = process.env.EVO_BETHANIA_INSTANCE?.trim() || "bethania";

      await backofficeEvoApiService.sendTextMessage({
        instanceName,
        number: normalizedPhone,
        text: LINK_CONFIRMED_WHATSAPP_MESSAGE,
      });

      if (channel) {
        await backofficeBotRepository.createMessage({
          channelId: channel.id,
          userLinkId,
          direction: "outbound",
          payload: {
            messageType: "text",
            contentText: LINK_CONFIRMED_WHATSAPP_MESSAGE,
            mediaUrl: null,
            caption: null,
            mediaFileName: null,
            linkPreview: null,
            pushName: channel.displayName,
          },
        });
      }
    } catch (error) {
      // Vínculo já está confirmado — falha no aviso não deve reverter o auth.
      console.error("[BackofficeBotAuthUseCase][notifyLinkConfirmed]", error);
    }
  }

  /**
   * Alinha status do canal com a Evolution antes de expor botAvailable na Account.
   * Evita card indisponível por status stale após reativar o canal.
   *
   * @param force — bypass do TTL (usar em linkInitiate / ações explícitas)
   */
  private async syncPrimaryChannelFromEvolution(options?: {
    force?: boolean;
  }): Promise<SyncedChannel> {
    const force = options?.force === true;
    const now = Date.now();

    if (!force && channelSyncInFlight) {
      return channelSyncInFlight;
    }

    if (!force && now - lastChannelSyncAtMs < CHANNEL_SYNC_TTL_MS) {
      return backofficeBotRepository.findPrimaryChannel();
    }

    const run = this.doSyncPrimaryChannelFromEvolution().finally(() => {
      channelSyncInFlight = null;
    });

    channelSyncInFlight = run;
    return run;
  }

  private async doSyncPrimaryChannelFromEvolution(): Promise<SyncedChannel> {
    const channel = await backofficeBotRepository.findPrimaryChannel();
    if (!channel) {
      lastChannelSyncAtMs = Date.now();
      return null;
    }

    const instanceName = process.env.EVO_BETHANIA_INSTANCE?.trim() || "bethania";
    const evoStatus = await backofficeEvoApiService
      .getInstanceConnectionState(instanceName)
      .catch((error) => {
        console.error("[BackofficeBotAuthUseCase][syncPrimaryChannelFromEvolution] state", error);
        return null;
      });

    if (!evoStatus) {
      lastChannelSyncAtMs = Date.now();
      return channel;
    }

    let phoneNumber = channel.phoneNumber;

    if (evoStatus === "open") {
      const livePhone = await backofficeEvoApiService
        .getInstancePhoneNumber(instanceName)
        .catch((error) => {
          console.error("[BackofficeBotAuthUseCase][syncPrimaryChannelFromEvolution] phone", error);
          return null;
        });

      // Não promover a connected com telefone stale se o lookup live falhou.
      if (!livePhone) {
        lastChannelSyncAtMs = Date.now();
        return channel;
      }
      phoneNumber = livePhone;
    }

    const nextStatus = mapEvoStatusToChannelStatus(evoStatus);
    const phoneChanged = (phoneNumber ?? null) !== (channel.phoneNumber ?? null);
    const statusChanged = channel.status !== nextStatus;
    if (!phoneChanged && !statusChanged) {
      lastChannelSyncAtMs = Date.now();
      return channel;
    }

    const updated = await backofficeBotRepository.upsertChannel({
      status: nextStatus,
      phoneNumber: phoneNumber ?? null,
    });
    lastChannelSyncAtMs = Date.now();
    return updated;
  }

  async linkInitiate(profileId: string): Promise<Output> {
    try {
      await this.syncPrimaryChannelFromEvolution({ force: true });
      const result = await backofficeBotAuthService.linkInitiate(profileId);
      if (!result.ok) {
        const linkError = buildBethaniaLinkErrorResult(result.error);
        console.error("[BackofficeBotAuthUseCase][linkInitiate]", {
          correlationId: linkError.correlationId,
          errorCode: linkError.errorCode,
          serviceError: result.error,
          profileId,
        });
        return new Output(false, [], [mapAuthError(result.error)], linkError);
      }
      return new Output(true, [], [], result.result);
    } catch (error) {
      const linkError = buildBethaniaLinkErrorResult(null, { isInternal: true });
      console.error("[BackofficeBotAuthUseCase][linkInitiate]", {
        correlationId: linkError.correlationId,
        errorCode: linkError.errorCode,
        profileId,
        error,
      });
      return new Output(false, [], ["Erro ao iniciar vínculo"], linkError);
    }
  }

  async linkStatus(profileId: string): Promise<Output> {
    try {
      await this.syncPrimaryChannelFromEvolution();
      const result = await backofficeBotAuthService.linkStatus(profileId);
      return new Output(true, [], [], result.result);
    } catch (error) {
      console.error("[BackofficeBotAuthUseCase][linkStatus]", error);
      return new Output(false, [], ["Erro ao consultar vínculo"], null);
    }
  }

  async revokeLink(profileId: string): Promise<Output> {
    try {
      const result = await backofficeBotAuthService.revokeLink(profileId);
      if (!result.ok) {
        return new Output(false, [], [mapAuthError(result.error)], null);
      }
      return new Output(true, ["Vínculo revogado"], [], result.result);
    } catch (error) {
      console.error("[BackofficeBotAuthUseCase][revokeLink]", error);
      return new Output(false, [], ["Erro ao revogar vínculo"], null);
    }
  }

  async getAuthStatus(normalizedPhone: string): Promise<Output> {
    try {
      const result = await backofficeBotAuthService.getAuthStatus(normalizedPhone);
      if (!result.ok) {
        return new Output(false, [], [mapAuthError(result.error)], null);
      }
      return new Output(true, [], [], result.result);
    } catch (error) {
      console.error("[BackofficeBotAuthUseCase][getAuthStatus]", error);
      return new Output(false, [], ["Erro ao consultar status de autenticação"], null);
    }
  }
}

export const backofficeBotAuthUseCase = new BackofficeBotAuthUseCase();
