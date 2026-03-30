import { Output } from "@/lib/output";
import type { IProfileRepository } from "@/app/api/infra/data/repositories/profile/IProfileRepository";
import { togglePermanentSubscriptionUseCase } from "./TogglePermanentSubscriptionUseCase";
import type { FreeSubscriptionOptions } from "./TogglePermanentSubscriptionUseCase";

/**
 * UseCase para atualizar flag de assinatura permanente (com guarda de autenticação master).
 * Delega a lógica de criação/cancelamento Asaas ao TogglePermanentSubscriptionUseCase.
 */
export class UpdatePermanentSubscriptionUseCase {
  constructor(private profileRepository: IProfileRepository) {}

  async updatePermanentSubscription(
    targetSupabaseId: string,
    hasPermanentSubscription: boolean,
    requestingUserId: string,
    options?: FreeSubscriptionOptions
  ): Promise<Output> {
    try {
      if (!targetSupabaseId) {
        return new Output(false, [], ['SupabaseID do perfil é obrigatório'], null);
      }

      if (typeof hasPermanentSubscription !== 'boolean') {
        return new Output(false, [], ['O campo hasPermanentSubscription deve ser um boolean'], null);
      }

      const requestingUser = await this.profileRepository.findById(requestingUserId);

      if (!requestingUser) {
        return new Output(false, [], ['Usuário requisitante não encontrado'], null);
      }

      if (!requestingUser.isMaster) {
        return new Output(false, [], ['Apenas usuários master podem alterar assinatura permanente'], null);
      }

      const targetProfile = await this.profileRepository.findBySupabaseId(targetSupabaseId);

      if (!targetProfile) {
        return new Output(false, [], ['Perfil alvo não encontrado'], null);
      }

      return await togglePermanentSubscriptionUseCase.togglePermanentSubscription(
        targetProfile.id,
        hasPermanentSubscription,
        options
      );
    } catch (error) {
      console.error('❌ [UpdatePermanentSubscriptionUseCase] Erro:', error);
      return new Output(false, [], ['Erro ao atualizar assinatura permanente'], null);
    }
  }
}
