// app/api/useCases/profiles/ITogglePermanentSubscriptionUseCase.ts
import type { Output } from "@/lib/output";
import type { FreeSubscriptionOptions } from "./TogglePermanentSubscriptionUseCase";

export interface ITogglePermanentSubscriptionUseCase {
  /**
   * Torna um profile vitalício ou remove a assinatura permanente.
   * Ao ativar, cria assinatura R$0,00 no Asaas com o período determinado.
   * @param profileId - ID interno do profile
   * @param enable - true para ativar, false para desativar
   * @param options - Datas de início e fim da assinatura gratuita (opcional)
   */
  togglePermanentSubscription(
    profileId: string,
    enable: boolean,
    options?: FreeSubscriptionOptions
  ): Promise<Output>;
}
