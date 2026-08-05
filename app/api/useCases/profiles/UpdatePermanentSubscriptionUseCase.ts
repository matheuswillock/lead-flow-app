import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import type { IProfileRepository } from "@/app/api/infra/data/repositories/profile/IProfileRepository";
import { auditLogService } from "@/app/api/services/audit/AuditLogService";

/**
 * UseCase para atualizar flag de assinatura permanente.
 * Autorização: exclusiva do Backoffice (rota via getBackofficeAccess).
 */
export class UpdatePermanentSubscriptionUseCase {
  constructor(private profileRepository: IProfileRepository) {}

  /**
   * Atualiza hasPermanentSubscription no ProfileSubscription (preferencial)
   * e espelha no Profile enquanto o dual-write pré-Estágio 6 existir.
   */
  async updatePermanentSubscription(
    targetSupabaseId: string,
    hasPermanentSubscription: boolean,
    actorProfileId: string
  ): Promise<Output> {
    try {
      if (!targetSupabaseId) {
        return new Output(false, [], ["SupabaseID do perfil é obrigatório"], null);
      }

      if (typeof hasPermanentSubscription !== "boolean") {
        return new Output(
          false,
          [],
          ["O campo hasPermanentSubscription deve ser um boolean"],
          null
        );
      }

      const targetProfile = await this.profileRepository.findBySupabaseId(targetSupabaseId);

      if (!targetProfile) {
        return new Output(false, [], ["Perfil alvo não encontrado"], null);
      }

      const existingSubscription = await prisma.profileSubscription.findUnique({
        where: { profileId: targetProfile.id },
        select: { id: true, hasPermanentSubscription: true },
      });

      const before = {
        profile: targetProfile.hasPermanentSubscription,
        profileSubscription: existingSubscription?.hasPermanentSubscription ?? null,
      };

      const updatedProfile = await prisma.$transaction(async (tx) => {
        if (existingSubscription) {
          await tx.profileSubscription.update({
            where: { id: existingSubscription.id },
            data: { hasPermanentSubscription },
          });
        } else {
          await tx.profileSubscription.create({
            data: {
              profileId: targetProfile.id,
              hasPermanentSubscription,
              subscriptionStatus: hasPermanentSubscription ? "active" : "canceled",
            },
          });
        }

        return tx.profile.update({
          where: { id: targetProfile.id },
          data: {
            hasPermanentSubscription,
            ...(hasPermanentSubscription ? { hasUnlimitedUsers: true } : {}),
          },
        });
      });

      await auditLogService.logAudit({
        entityType: "PROFILE",
        entityId: targetProfile.id,
        action: "ROLE_CHANGE",
        actorProfileId,
        before,
        after: {
          hasPermanentSubscription: updatedProfile.hasPermanentSubscription,
          hasUnlimitedUsers: updatedProfile.hasUnlimitedUsers,
        },
        metadata: { source: "backoffice_permanent_subscription" },
      });

      console.info("[UpdatePermanentSubscriptionUseCase] vitalício atualizado", {
        targetProfileId: targetProfile.id,
        hasPermanentSubscription,
        actorProfileId,
      });

      return new Output(
        true,
        ["Assinatura permanente atualizada com sucesso"],
        [],
        {
          id: updatedProfile.id,
          email: updatedProfile.email,
          fullName: updatedProfile.fullName,
          hasPermanentSubscription: updatedProfile.hasPermanentSubscription,
        }
      );
    } catch (error) {
      console.error("[UpdatePermanentSubscriptionUseCase] Erro:", error);

      return new Output(false, [], ["Erro ao atualizar assinatura permanente"], null);
    }
  }
}
