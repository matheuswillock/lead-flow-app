import type { Output } from "@/lib/output"
import type {
  CreateProviderInstanceBody,
  SetProviderCredentialBody,
  UpdateProviderInstanceBody,
} from "@/lib/payment-provider/admin-contract"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "@/lib/payment-provider/types"

export type ProviderConfigActor = {
  readonly profileId: string
  readonly backofficeUserId: string | null
  readonly backofficeEmail: string | null
}

/** Falha do UseCase: `Output.result` carrega o código para a rota mapear o status HTTP. */
export type ProviderConfigErrorCode = "VALIDATION" | "CONFLICT" | "NOT_FOUND" | "INTERNAL"

/** Corpo do PUT: `id` (novo) ou `provider` + `environment` (corpo antigo, instância única). */
export type UpdateProviderConfigInput = Omit<UpdateProviderInstanceBody, "id"> & {
  readonly id?: string
  readonly provider?: PaymentProviderKey
  readonly environment?: PaymentProviderEnvironment
}

export interface IPaymentProviderConfigUseCase {
  list(input: { readonly environment: PaymentProviderEnvironment }): Promise<Output>
  listAdapters(): Output
  create(input: CreateProviderInstanceBody, actor: ProviderConfigActor): Promise<Output>
  update(input: UpdateProviderConfigInput, actor: ProviderConfigActor): Promise<Output>
  setCredential(input: SetProviderCredentialBody, actor: ProviderConfigActor): Promise<Output>
  deleteCredential(input: { readonly configId: string; readonly key: string }, actor: ProviderConfigActor): Promise<Output>
  history(input: { readonly configId: string }): Promise<Output>
}
