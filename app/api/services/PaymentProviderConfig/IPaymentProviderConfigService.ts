import type {
  CreateProviderInstanceBody,
  ProviderAdaptersResponse,
  ProviderInstanceView,
  SetProviderCredentialBody,
  UpdateProviderInstanceBody,
} from "@/lib/payment-provider/admin-contract"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "@/lib/payment-provider/types"
import type { AuditAction } from "@prisma/client"

/** Mudança auditável produzida por uma operação; nunca contém valor de credencial. */
export type ProviderAuditDraft = {
  readonly action: AuditAction
  readonly entityId: string
  readonly operation: string
  readonly before: unknown | null
  readonly after: unknown | null
  readonly extra?: Record<string, unknown>
}

export type ProviderInstanceChange = {
  readonly view: ProviderInstanceView
  readonly audit: ProviderAuditDraft | null
}

/**
 * Registra a trilha ANTES de a gravação do segredo ser confirmada. Se lançar, a gravação não
 * acontece (falha fechada). Quando informado, a mudança devolvida vem com `audit: null`.
 */
export type ProviderAuditSink = (draft: ProviderAuditDraft) => Promise<void>

export type UpdateProviderInstanceInput = Omit<UpdateProviderInstanceBody, "id"> & { readonly id: string }

export interface IPaymentProviderConfigService {
  list(environment: PaymentProviderEnvironment): Promise<readonly ProviderInstanceView[]>
  get(id: string): Promise<ProviderInstanceView>
  /** Compatibilidade com o corpo antigo: só resolve quando há uma única instância. */
  resolveLegacyTargetId(
    provider: PaymentProviderKey,
    environment: PaymentProviderEnvironment,
  ): Promise<string>
  listAdapters(): ProviderAdaptersResponse
  create(input: CreateProviderInstanceBody): Promise<ProviderInstanceChange>
  update(input: UpdateProviderInstanceInput): Promise<ProviderInstanceChange>
  setCredential(
    input: SetProviderCredentialBody,
    actorProfileId: string | null,
    recordAudit?: ProviderAuditSink,
  ): Promise<ProviderInstanceChange>
  deleteCredential(
    configId: string,
    key: string,
    recordAudit?: ProviderAuditSink,
  ): Promise<ProviderInstanceChange>
}
