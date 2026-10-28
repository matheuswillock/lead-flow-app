import { Output } from "@/lib/output"
import type { IPaymentProviderConfigService } from "@/app/api/services/PaymentProviderConfig/IPaymentProviderConfigService"
import type { ProviderRoutingConfigPatch } from "@/lib/payment-provider/routing-config"
import type {
  IPaymentProviderConfigUseCase,
  PaymentProviderConfigUseCaseInput,
} from "./IPaymentProviderConfigUseCase"

export type PaymentProviderConfigAuditLogger = {
  info(message: string, context: Record<string, unknown>): void
}

export type PaymentProviderConfigUseCaseDeps = {
  readonly audit?: PaymentProviderConfigAuditLogger
  /** Chamado após um update bem-sucedido, para invalidar caches derivados da config. */
  readonly onConfigUpdated?: () => void
}

export class PaymentProviderConfigUseCase implements IPaymentProviderConfigUseCase {
  private readonly audit: PaymentProviderConfigAuditLogger
  private readonly onConfigUpdated: () => void

  constructor(
    private readonly service: IPaymentProviderConfigService,
    deps: PaymentProviderConfigUseCaseDeps = {},
  ) {
    this.audit = deps.audit ?? { info: console.info }
    this.onConfigUpdated = deps.onConfigUpdated ?? (() => undefined)
  }

  async list(input: PaymentProviderConfigUseCaseInput): Promise<Output> {
    try {
      const configurations = await this.service.list(input.environment)
      return new Output(true, [], [], configurations)
    } catch (error) {
      console.error("[PaymentProviderConfigUseCase][list]", error)
      return new Output(false, [], ["Não foi possível carregar a configuração dos providers"], null)
    }
  }

  async update(
    input: PaymentProviderConfigUseCaseInput & {
      readonly provider: NonNullable<PaymentProviderConfigUseCaseInput["provider"]>
      readonly patch: NonNullable<PaymentProviderConfigUseCaseInput["patch"]>
    },
  ): Promise<Output> {
    try {
      const configuration = await this.service.update({
        provider: input.provider,
        environment: input.environment,
        patch: input.patch,
      })
      this.onConfigUpdated()
      this.audit.info("[PaymentProviderConfig][audit]", {
        actorProfileId: input.actor?.profileId ?? null,
        actorBackofficeUserId: input.actor?.backofficeUserId ?? null,
        provider: input.provider,
        environment: input.environment,
        changedFields: changedFields(input.patch),
        cardEnabled: configuration.cardEnabled,
        revision: configuration.revision,
      })
      return new Output(true, ["Configuração atualizada"], [], configuration)
    } catch (error) {
      console.error("[PaymentProviderConfigUseCase][update]", error)
      const message =
        error instanceof Error ? error.message : "Não foi possível atualizar a configuração"
      return new Output(false, [], [message], null)
    }
  }
}

function changedFields(patch: ProviderRoutingConfigPatch): string[] {
  return Object.keys(patch).filter((field) => field !== "expectedRevision")
}
