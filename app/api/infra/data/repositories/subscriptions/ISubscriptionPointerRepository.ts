import type { AsaasAccountId } from "@/lib/asaas";

export interface MigrateSubscriptionPointersInput {
  profileId: string;
  /**
   * Id da assinatura que está sendo substituída. Usado como filtro do
   * `ProfileSubscription` para nunca sobrescrever um ponteiro de
   * produto/adesão distinto que exista para o mesmo profile
   * (`prisma/schema.prisma`, comentário de `ProfileSubscription.
   * asaasSubscriptionAccount`).
   */
  previousSubscriptionId: string;
  newSubscriptionId: string;
  /** Conta Asaas dona do `newSubscriptionId`. */
  account: AsaasAccountId;
  subscriptionNextDueDate: Date;
  operatorCount: number;
}

/**
 * Escrita atômica dos dois ponteiros de assinatura de um profile
 * (`Profile.asaasSubscriptionId`/`asaasSubscriptionAccount` e o irmão em
 * `ProfileSubscription`).
 *
 * Existe por causa do achado P1 da revisão do PR #1207 (thread
 * PRRT_...YP_r): as duas escritas viviam soltas no
 * `SubscriptionUpgradeUseCase`. Uma falha na segunda, depois de a primeira
 * ter passado, deixava o `Profile` apontando para a assinatura nova da
 * `primary` enquanto o `ProfileSubscription` retinha o id legado — e
 * `AsaasSubscriptionSyncRepository.getSyncSnapshot` combina o **id** do
 * `ProfileSubscription` com a **conta** do `Profile`, passando a consultar
 * o Asaas na conta errada. Divergência entre os irmãos é exatamente o
 * estado que a rodada inteira está tentando eliminar, então ela não pode
 * nascer de um erro parcial.
 */
export interface ISubscriptionPointerRepository {
  migrateSubscriptionPointers(input: MigrateSubscriptionPointersInput): Promise<void>;
}
