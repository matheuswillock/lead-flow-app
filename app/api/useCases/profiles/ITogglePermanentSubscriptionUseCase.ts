// app/api/useCases/profiles/ITogglePermanentSubscriptionUseCase.ts
import type { Output } from "@/lib/output";

export interface ITogglePermanentSubscriptionUseCase {
  /**
   * Torna um profile vitalício (bypass de validação Asaas)
   * @param profileId - ID do profile
   * @param enable - true para ativar, false para desativar
   */
  togglePermanentSubscription(profileId: string, enable: boolean): Promise<Output>;
}
