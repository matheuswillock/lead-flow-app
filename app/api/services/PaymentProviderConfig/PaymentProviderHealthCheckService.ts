import type { IPaymentProviderConfigRepository } from "@/app/api/infra/data/repositories/paymentProviderConfig/IPaymentProviderConfigRepository"
import type {
  HealthCheckCapability,
  ProviderHealthCheckResult,
} from "@/lib/payment-provider/contracts"
import { ProviderInstanceNotFoundError, type ProviderInstanceRecord } from "@/lib/payment-provider/instance"
import type {
  DegradedInstance,
  HealthCheckMode,
  HealthCheckSweepSummary,
  IPaymentProviderHealthCheckService,
} from "./IPaymentProviderHealthCheckService"

/** Cria a sonda do adapter da instância (async: hidrata credenciais). Lança se não suportado. */
export type HealthCheckProviderFactory = (
  instance: ProviderInstanceRecord,
) => Promise<HealthCheckCapability>

const CONFIGURATION_UNHEALTHY: ProviderHealthCheckResult = {
  healthy: false,
  errorCode: "CONFIGURATION_INVALID",
  errorMessage: "Credenciais do provider ausentes ou inválidas",
}

const UNEXPECTED_UNHEALTHY: ProviderHealthCheckResult = {
  healthy: false,
  errorCode: "HEALTH_CHECK_FAILED",
  errorMessage: "Falha inesperada ao sondar o provider",
}

export class PaymentProviderHealthCheckService implements IPaymentProviderHealthCheckService {
  constructor(
    private readonly repository: IPaymentProviderConfigRepository,
    private readonly createProvider: HealthCheckProviderFactory,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async check(input: { readonly id: string; readonly mode?: HealthCheckMode }) {
    const instance = await this.repository.findById(input.id)
    if (!instance) throw new ProviderInstanceNotFoundError()
    const result = await this.probe(instance)
    return this.repository.recordHealthCheck({
      id: instance.id,
      healthStatus: nextStatus(instance, result, input.mode ?? "manual"),
      checkedAt: this.now(),
      errorCode: result.healthy ? null : result.errorCode,
      errorMessage: result.healthy ? null : result.errorMessage,
    })
  }

  async checkAll(): Promise<HealthCheckSweepSummary> {
    const instances = (await this.repository.listAll()).filter(isMonitored)
    const degraded: DegradedInstance[] = []
    let healthy = 0
    let failing = 0
    for (const instance of instances) {
      const wasUnhealthy = instance.healthStatus === "UNHEALTHY"
      const updated = await this.check({ id: instance.id, mode: "scheduled" })
      if (updated.lastErrorCode === null) {
        healthy += 1
        continue
      }
      failing += 1
      if (updated.healthStatus === "UNHEALTHY" && !wasUnhealthy) {
        degraded.push({
          id: updated.id,
          displayName: updated.displayName,
          provider: updated.provider,
          environment: updated.environment,
          errorCode: updated.lastErrorCode,
        })
      }
    }
    return { checked: instances.length, healthy, failing, degraded }
  }

  private async probe(instance: ProviderInstanceRecord): Promise<ProviderHealthCheckResult> {
    let provider: HealthCheckCapability
    try {
      provider = await this.createProvider(instance)
    } catch {
      return CONFIGURATION_UNHEALTHY
    }
    try {
      return await provider.checkHealth()
    } catch {
      return UNEXPECTED_UNHEALTHY
    }
  }
}

/** Instâncias fora de uso (desligadas e sem rollout) não são sondadas pelo cron. */
function isMonitored(instance: ProviderInstanceRecord): boolean {
  return !instance.killSwitch && (instance.enabled || instance.rolloutState !== "DISABLED")
}

/**
 * Manual: reflete o resultado na hora. Agendado: a primeira falha só é registrada (status mantido);
 * a segunda falha seguida degrada para UNHEALTHY.
 */
function nextStatus(
  instance: ProviderInstanceRecord,
  result: ProviderHealthCheckResult,
  mode: HealthCheckMode,
): "HEALTHY" | "UNHEALTHY" | null {
  if (result.healthy) return "HEALTHY"
  if (mode === "manual") return "UNHEALTHY"
  return instance.lastErrorCode !== null ? "UNHEALTHY" : null
}
