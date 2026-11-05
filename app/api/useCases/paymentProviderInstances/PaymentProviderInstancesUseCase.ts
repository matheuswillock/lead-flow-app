import { Output } from "@/lib/output"
import { getCredentialDescriptors } from "@/lib/payment-provider/credential-schema"
import type { PaymentProviderKey } from "@/lib/payment-provider/types"
import type { IPaymentProviderCredentialRepository } from "@/app/api/infra/data/repositories/paymentProviderCredential/IPaymentProviderCredentialRepository"
import type {
  CreateProviderInstanceCommand,
  IPaymentProviderInstancesUseCase,
  UpdateProviderInstanceCommand,
} from "./IPaymentProviderInstancesUseCase"

const ABACATE_CAPABILITIES = ["ONE_TIME_PAYMENT", "PIX", "CARD", "STATUS_QUERY", "FULL_REFUND", "WEBHOOK"]

export class PaymentProviderInstancesUseCase implements IPaymentProviderInstancesUseCase {
  constructor(
    private readonly repository: IPaymentProviderCredentialRepository,
    private readonly audit: { logAudit(entry: {
      entityType: "PAYMENT_PROVIDER_CONFIG"
      entityId: string
      action: "CREATE" | "UPDATE"
      actorProfileId: string
      before: Record<string, unknown> | null
      after: Record<string, unknown>
      metadata: Record<string, unknown>
    }): Promise<void> } = { logAudit: async () => undefined },
  ) {}

  async list(environment?: CreateProviderInstanceCommand["environment"]): Promise<Output> {
    try {
      const instances = await this.repository.list(environment)
      return new Output(true, [], [], instances.map((instance) => ({
        ...instance,
        capabilities: instance.provider === "ABACATE_PAY" ? ABACATE_CAPABILITIES : [],
        isSelectable: instance.provider === "ABACATE_PAY",
      })))
    } catch (error) {
      console.error("[PaymentProviderInstancesUseCase][list]", error)
      return new Output(false, [], ["Não foi possível listar as instâncias de pagamento"], null)
    }
  }

  async create(input: CreateProviderInstanceCommand): Promise<Output> {
    const validationMessage = validateInstance(input)
    if (validationMessage) return new Output(false, [], [validationMessage], null)

    try {
      const instance = await this.repository.create({
        ...input,
        displayName: input.displayName.trim(),
        externalAccountContext: input.externalAccountContext.trim(),
        logoUrl: input.logoUrl?.trim() || null,
        logoAltText: input.logoAltText?.trim() || null,
      })
      await this.audit.logAudit({
        entityType: "PAYMENT_PROVIDER_CONFIG",
        entityId: instance.id,
        action: "CREATE",
        actorProfileId: input.actorProfileId,
        before: null,
        after: {
          provider: instance.provider,
          environment: instance.environment,
          displayName: instance.displayName,
          externalAccountContext: instance.externalAccountContext,
          credentialKeys: Object.keys(instance.credentials),
        },
        metadata: { credentialValuesOmitted: true },
      })
      return new Output(true, ["Instância criada"], [], {
        ...instance,
        capabilities: instance.provider === "ABACATE_PAY" ? ABACATE_CAPABILITIES : [],
        isSelectable: instance.provider === "ABACATE_PAY",
      })
    } catch (error) {
      console.error("[PaymentProviderInstancesUseCase][create]", error)
      const message = error instanceof Error ? error.message : "Não foi possível criar a instância"
      return new Output(false, [], [message], null)
    }
  }

  async update(input: UpdateProviderInstanceCommand): Promise<Output> {
    if (input.displayName !== undefined && !input.displayName.trim()) {
      return new Output(false, [], ["Nome da instância não pode ficar vazio"], null)
    }
    if (input.logoUrl && !isHttpsUrl(input.logoUrl)) return new Output(false, [], ["A logo deve usar uma URL HTTPS válida"], null)
    if (Object.values(input.credentials).some((value) => typeof value !== "string")) {
      return new Output(false, [], ["Credenciais inválidas"], null)
    }

    try {
      const current = await this.repository.findById(input.id)
      if (!current) return new Output(false, [], ["Instância não encontrada"], null)
      if (input.isDefault && !isSelectable(current.provider)) {
        return new Output(false, [], ["Este provider ainda não pode ser definido como padrão"], null)
      }
      if (input.isDefault && (!current.enabled || current.rolloutState !== "ACTIVE" || current.healthStatus !== "HEALTHY")) {
        return new Output(false, [], ["Ative e valide a instância antes de defini-la como padrão"], null)
      }
      const updated = await this.repository.update({
        ...input,
        ...(input.displayName !== undefined ? { displayName: input.displayName.trim() } : {}),
        ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl?.trim() || null } : {}),
        ...(input.logoAltText !== undefined ? { logoAltText: input.logoAltText?.trim() || null } : {}),
      })
      await this.audit.logAudit({
        entityType: "PAYMENT_PROVIDER_CONFIG",
        entityId: updated.id,
        action: "UPDATE",
        actorProfileId: input.actorProfileId,
        before: {
          displayName: current.displayName,
          isDefault: current.isDefault,
          credentialKeys: Object.keys(current.credentials),
        },
        after: {
          displayName: updated.displayName,
          isDefault: updated.isDefault,
          credentialKeys: Object.keys(updated.credentials),
        },
        metadata: { credentialValuesOmitted: true },
      })
      return new Output(true, ["Instância atualizada"], [], updated)
    } catch (error) {
      console.error("[PaymentProviderInstancesUseCase][update]", error)
      return new Output(false, [], ["Não foi possível atualizar a instância"], null)
    }
  }
}

function validateInstance(input: CreateProviderInstanceCommand): string | null {
  if (!input.displayName.trim() || !input.externalAccountContext.trim()) {
    return "Nome e contexto da instância são obrigatórios"
  }
  if (input.isDefault && !isSelectable(input.provider)) {
    return "Este provider ainda não pode ser definido como padrão"
  }
  if (input.logoUrl && !isHttpsUrl(input.logoUrl)) return "A logo deve usar uma URL HTTPS válida"
  const descriptors = getCredentialDescriptors(input.provider, input.environment)
  if (Object.entries(descriptors).some(([key, descriptor]) => descriptor.required && !input.credentials[key]?.trim())) {
    return "Preencha todas as credenciais obrigatórias do provider"
  }
  if (Object.entries(input.credentials).some(([key, value]) => !key.trim() || typeof value !== "string")) {
    return "Credenciais inválidas"
  }
  return null
}

function isSelectable(provider: PaymentProviderKey): boolean {
  return provider === "ABACATE_PAY"
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && !url.username && !url.password
  } catch {
    return false
  }
}
