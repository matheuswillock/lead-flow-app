// app/api/useCases/profiles/TogglePermanentSubscriptionUseCase.ts
import { prisma } from "@/app/api/infra/data/prisma";
import { Output } from "@/lib/output";
import type { ITogglePermanentSubscriptionUseCase } from "./ITogglePermanentSubscriptionUseCase";

export class TogglePermanentSubscriptionUseCase implements ITogglePermanentSubscriptionUseCase {
  /**
   * Torna um profile vitalício ou remove a assinatura permanente
   * Usuários vitalícios não passam por validação de assinatura Asaas
   */
  async togglePermanentSubscription(profileId: string, enable: boolean): Promise<Output> {
    try {
      // Validação: profileId obrigatório
      if (!profileId) {
        return new Output(
          false,
          [],
          ['Profile ID é obrigatório'],
          null
        );
      }

      // Buscar profile
      const profile = await prisma.profile.findUnique({
        where: { id: profileId },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          subscription: {
            select: {
              hasPermanentSubscription: true,
            },
          },
        }
      });

      if (!profile) {
        return new Output(
          false,
          [],
          ['Profile não encontrado'],
          null
        );
      }

      // Atualizar status de assinatura permanente
      await prisma.profileSubscription.upsert({
        where: { profileId },
        create: {
          profile: {
            connect: { id: profileId },
          },
          hasPermanentSubscription: enable,
        },
        update: {
          hasPermanentSubscription: enable,
        },
      });

      const action = enable ? 'ativada' : 'desativada';
      console.info(`✅ [TogglePermanentSubscription] Assinatura permanente ${action} para profile:`, {
        profileId,
        email: profile.email,
        hasPermanentSubscription: enable
      });

      return new Output(
        true,
        [`Assinatura permanente ${action} com sucesso`],
        [],
        {
          id: profile.id,
          email: profile.email,
          fullName: profile.fullName,
          hasPermanentSubscription: enable,
        }
      );

    } catch (error) {
      console.error('❌ [TogglePermanentSubscription] Erro:', error);
      
      return new Output(
        false,
        [],
        ['Erro ao atualizar assinatura permanente'],
        null
      );
    }
  }
}

// Instância única
export const togglePermanentSubscriptionUseCase = new TogglePermanentSubscriptionUseCase();
