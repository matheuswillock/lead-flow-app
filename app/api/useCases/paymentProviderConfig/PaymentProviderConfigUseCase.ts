import type { AuditEntityType } from "@prisma/client"
import type {
  AuditLogHistoryRow,
  AuditLogEntry,
} from "@/app/api/infra/data/repositories/audit/IAuditLogRepository"
import type {
  IPaymentProviderConfigService,
  ProviderInstanceChange,
} from "@/app/api/services/PaymentProviderConfig/IPaymentProviderConfigService"
import { buildAuditActorMetadata } from "@/app/api/useCases/audit/auditActor"
import { Output } from "@/lib/output"
import type {
  CreateProviderInstanceBody,
  SetProviderCredentialBody,
} from "@/lib/payment-provider/admin-contract"
import { CredentialCipherError } from "@/lib/payment-provider/credential-cipher"
import {
  ProviderInstanceConflictError,
  ProviderInstanceNotFoundError,
  ProviderInstanceValidationError,
} from "@/lib/payment-provider/instance"
import { toHistoryItem } from "@/lib/payment-provider/instance-audit"
import { ProviderRoutingConfigError } from "@/lib/payment-provider/routing-config"
import type {
  IPaymentProviderConfigUseCase,
  ProviderConfigActor,
  ProviderConfigErrorCode,
  UpdateProviderConfigInput,
} from "./IPaymentProviderConfigUseCase"

export type ProviderConfigAuditPort = {
  logAudit(entry: AuditLogEntry): Promise<void>
  listHistory(entityType: AuditEntityType, entityId: string, limit: number): Promise<AuditLogHistoryRow[]>
}

const ENTITY_TYPE: AuditEntityType = "PAYMENT_PROVIDER_CONFIG"
const HISTORY_LIMIT = 100

export class PaymentProviderConfigUseCase implements IPaymentProviderConfigUseCase {
  constructor(
    private readonly service: IPaymentProviderConfigService,
    private readonly audit: ProviderConfigAuditPort,
  ) {}

  async list(input: { readonly environment: "DEV" | "PRODUCTION" }): Promise<Output> {
    return this.run("list", "Não foi possível carregar a configuração dos providers", async () =>
      new Output(true, [], [], await this.service.list(input.environment)),
    )
  }

  listAdapters(): Output {
    return new Output(true, [], [], this.service.listAdapters())
  }

  create(input: CreateProviderInstanceBody, actor: ProviderConfigActor): Promise<Output> {
    return this.run("create", "Não foi possível criar a instância", async () =>
      this.finish(await this.service.create(input), actor, "Instância criada"),
    )
  }

  update(input: UpdateProviderConfigInput, actor: ProviderConfigActor): Promise<Output> {
    return this.run("update", "Não foi possível atualizar a configuração", async () => {
      const id = input.id ?? (await this.resolveLegacyId(input))
      return this.finish(
        await this.service.update({ ...input, id }),
        actor,
        "Configuração atualizada",
      )
    })
  }

  setCredential(input: SetProviderCredentialBody, actor: ProviderConfigActor): Promise<Output> {
    return this.run("setCredential", "Não foi possível gravar a credencial", async () =>
      this.finish(await this.service.setCredential(input, actor.profileId), actor, "Credencial gravada"),
    )
  }

  deleteCredential(
    input: { readonly configId: string; readonly key: string },
    actor: ProviderConfigActor,
  ): Promise<Output> {
    return this.run("deleteCredential", "Não foi possível remover a credencial", async () =>
      this.finish(await this.service.deleteCredential(input.configId, input.key), actor, "Credencial removida"),
    )
  }

  history(input: { readonly configId: string }): Promise<Output> {
    return this.run("history", "Não foi possível carregar o histórico", async () => {
      await this.service.get(input.configId)
      const rows = await this.audit.listHistory(ENTITY_TYPE, input.configId, HISTORY_LIMIT)
      return new Output(true, [], [], { items: rows.map(toHistoryItem) })
    })
  }

  private async resolveLegacyId(input: UpdateProviderConfigInput): Promise<string> {
    if (!input.provider || !input.environment) {
      throw new ProviderInstanceValidationError("Informe o id da instância")
    }
    return this.service.resolveLegacyTargetId(input.provider, input.environment)
  }

  private async finish(change: ProviderInstanceChange, actor: ProviderConfigActor, message: string) {
    if (change.audit) {
      await this.audit.logAudit({
        entityType: ENTITY_TYPE,
        entityId: change.audit.entityId,
        action: change.audit.action,
        actorProfileId: actor.profileId,
        before: change.audit.before,
        after: change.audit.after,
        metadata: buildAuditActorMetadata(actor, {
          operation: change.audit.operation,
          ...(change.audit.extra ?? {}),
        }),
      })
    }
    return new Output(true, [message], [], change.view)
  }

  private async run(name: string, fallback: string, action: () => Promise<Output>): Promise<Output> {
    try {
      return await action()
    } catch (error) {
      const { code, message } = classify(error, fallback)
      if (code === "INTERNAL") console.error(`[PaymentProviderConfigUseCase][${name}]`, error instanceof Error ? error.name : "unknown")
      return new Output(false, [], [message], { errorCode: code })
    }
  }
}

function classify(error: unknown, fallback: string): { code: ProviderConfigErrorCode; message: string } {
  if (error instanceof ProviderInstanceNotFoundError) return { code: "NOT_FOUND", message: error.message }
  if (error instanceof ProviderInstanceConflictError) return { code: "CONFLICT", message: error.message }
  if (error instanceof ProviderInstanceValidationError) return { code: "VALIDATION", message: error.message }
  if (error instanceof ProviderRoutingConfigError) {
    const conflict = error.code === "REVISION_CONFLICT" || error.code === "ROLLOUT_INVALID"
    return { code: conflict ? "CONFLICT" : "VALIDATION", message: error.message }
  }
  if (error instanceof CredentialCipherError) {
    return { code: "INTERNAL", message: "A chave de cifra das credenciais não está disponível" }
  }
  return { code: "INTERNAL", message: fallback }
}
