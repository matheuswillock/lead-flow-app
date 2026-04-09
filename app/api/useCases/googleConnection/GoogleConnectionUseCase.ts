import { NotificationType } from "@prisma/client";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";
import type { IProfileRepository } from "@/app/api/infra/data/repositories/profile/IProfileRepository";
import { notificationService } from "@/app/api/services/notifications/NotificationService";
import { Output } from "@/lib/output";
import type {
  GoogleConnectionNotificationInput,
  IGoogleConnectionUseCase,
} from "./IGoogleConnectionUseCase";

const LOG_PREFIX = "[GoogleConnectionUseCase]";

export class GoogleConnectionUseCase implements IGoogleConnectionUseCase {
  constructor(private readonly repo: IProfileRepository = profileRepository) {}

  private async resolveNotificationTeamId(profileId: string, activeTeamId: string | null) {
    if (activeTeamId) {
      return activeTeamId;
    }

    return this.repo.findFirstTeamIdByProfileId(profileId);
  }

  async notifyGoogleConnected(input: GoogleConnectionNotificationInput): Promise<Output> {
    try {
      const notificationTeamId = await this.resolveNotificationTeamId(
        input.profileId,
        input.activeTeamId
      );

      if (!notificationTeamId) {
        console.info(`${LOG_PREFIX} Notificacao de conexao ignorada: sem teamId.`, {
          supabaseId: input.supabaseId,
        });
        return new Output(true, ["Notificacao ignorada por ausencia de time"], [], null);
      }

      await notificationService.createSystemNotification({
        teamId: notificationTeamId,
        recipientProfileId: input.profileId,
        type: NotificationType.TEAM_MEMBER_ADDED,
        message: `Conta Google conectada: ${input.googleEmail ?? "email nao identificado"}.`,
        metadata: {
          event: "GOOGLE_CONNECTED",
          googleEmail: input.googleEmail,
          previousGoogleEmail: input.previousGoogleEmail ?? null,
        },
      });

      return new Output(true, ["Notificacao de conexao criada"], [], null);
    } catch (error) {
      console.error(`${LOG_PREFIX} Erro ao criar notificacao de conexao Google:`, error);
      return new Output(false, [], ["Falha ao criar notificacao de conexao Google"], null);
    }
  }

  async notifyGoogleDisconnected(input: GoogleConnectionNotificationInput): Promise<Output> {
    try {
      const notificationTeamId = await this.resolveNotificationTeamId(
        input.profileId,
        input.activeTeamId
      );

      if (!notificationTeamId) {
        console.info(`${LOG_PREFIX} Notificacao de desconexao ignorada: sem teamId.`, {
          supabaseId: input.supabaseId,
        });
        return new Output(true, ["Notificacao ignorada por ausencia de time"], [], null);
      }

      await notificationService.createSystemNotification({
        teamId: notificationTeamId,
        recipientProfileId: input.profileId,
        type: NotificationType.TEAM_MEMBER_REMOVED,
        message: `Conta Google desconectada: ${input.googleEmail ?? "email nao identificado"}.`,
        metadata: {
          event: "GOOGLE_DISCONNECTED",
          googleEmail: input.googleEmail,
        },
      });

      return new Output(true, ["Notificacao de desconexao criada"], [], null);
    } catch (error) {
      console.error(`${LOG_PREFIX} Erro ao criar notificacao de desconexao Google:`, error);
      return new Output(false, [], ["Falha ao criar notificacao de desconexao Google"], null);
    }
  }
}

export const googleConnectionUseCase = new GoogleConnectionUseCase();
