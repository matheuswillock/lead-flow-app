import type { Prisma } from "@prisma/client";
import { Output } from "@/lib/output";
import { backofficeBotRepository } from "@/app/api/infra/data/repositories/backofficeBot/BackofficeBotRepository";
import type { IBackofficeBotNotificationPreferenceUseCase } from "./IBackofficeBotNotificationPreferenceUseCase";

export class BackofficeBotNotificationPreferenceUseCase
  implements IBackofficeBotNotificationPreferenceUseCase
{
  async listPreferences(profileId: string): Promise<Output> {
    try {
      const preferences = await backofficeBotRepository.listNotificationPreferences(profileId);
      return new Output(true, [], [], { preferences });
    } catch (error) {
      console.error("[BackofficeBotNotificationPreferenceUseCase][listPreferences]", error);
      return new Output(false, [], ["Erro ao listar preferências"], null);
    }
  }

  async upsertPreference(
    profileId: string,
    type: string,
    enabled: boolean,
    quietHours?: Record<string, unknown>
  ): Promise<Output> {
    try {
      const preference = await backofficeBotRepository.upsertNotificationPreference(
        profileId,
        type,
        enabled,
        quietHours as Prisma.InputJsonValue | undefined
      );
      return new Output(true, ["Preferência atualizada"], [], { preference });
    } catch (error) {
      console.error("[BackofficeBotNotificationPreferenceUseCase][upsertPreference]", error);
      return new Output(false, [], ["Erro ao atualizar preferência"], null);
    }
  }

  async resolveProfileIdFromUserLink(userLinkId: string) {
    const link = await backofficeBotRepository.findUserLinkById(userLinkId);
    if (!link?.isActive) {
      return {
        error: new Output(false, [], ["Vínculo não encontrado"], null),
        status: 404,
      };
    }
    return { profileId: link.profileId };
  }
}

export const backofficeBotNotificationPreferenceUseCase =
  new BackofficeBotNotificationPreferenceUseCase();
