import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import type { IProfileRepository } from "@/app/api/infra/data/repositories/profile/IProfileRepository";

/**
 * UseCase para atualizar flag de assinatura permanente
 * Apenas usuários master podem executar esta operação
 */
export class UpdatePermanentSubscriptionUseCase {
  constructor(private profileRepository: IProfileRepository) {}

  /**
   * Atualiza a flag hasPermanentSubscription de um perfil
   * @param targetSupabaseId - SupabaseID do perfil a ser atualizado
   * @param hasPermanentSubscription - Novo valor da flag
   * @param requestingUserId - ID do usuário que está fazendo a requisição
   */
  async updatePermanentSubscription(
    targetSupabaseId: string,
    hasPermanentSubscription: boolean,
    requestingUserId: string
  ): Promise<Output> {
    try {
      // 1. Validações de entrada
      if (!targetSupabaseId) {
        return new Output(
          false,
          [],
          ['SupabaseID do perfil é obrigatório'],
          null
        );
      }

      if (typeof hasPermanentSubscription !== 'boolean') {
        return new Output(
          false,
          [],
          ['O campo hasPermanentSubscription deve ser um boolean'],
          null
        );
      }

      // 2. Buscar perfil do usuário que está fazendo a requisição
      const requestingUser = await this.profileRepository.findById(requestingUserId);

      if (!requestingUser) {
        return new Output(
          false,
          [],
          ['Usuário requisitante não encontrado'],
          null
        );
      }

      // 3. Verificar se o usuário requisitante é master
      if (!requestingUser.isMaster) {
        return new Output(
          false,
          [],
          ['Apenas usuários master podem alterar assinatura permanente'],
          null
        );
      }

      // 4. Buscar perfil alvo por supabaseId
      const targetProfile = await this.profileRepository.findBySupabaseId(targetSupabaseId);

      if (!targetProfile) {
        return new Output(
          false,
          [],
          ['Perfil alvo não encontrado'],
          null
        );
      }

      // 5. Atualizar flag hasPermanentSubscription usando o ID interno
      const updatedProfile = await prisma.profile.update({
        where: { id: targetProfile.id },
        data: { hasPermanentSubscription }
      });

      return new Output(
        true,
        ['Assinatura permanente atualizada com sucesso'],
        [],
        {
          id: updatedProfile.id,
          email: updatedProfile.email,
          fullName: updatedProfile.fullName,
          hasPermanentSubscription: updatedProfile.hasPermanentSubscription
        }
      );

    } catch (error) {
      console.error('❌ [UpdatePermanentSubscriptionUseCase] Erro:', error);
      
      return new Output(
        false,
        [],
        ['Erro ao atualizar assinatura permanente'],
        null
      );
    }
  }
}
