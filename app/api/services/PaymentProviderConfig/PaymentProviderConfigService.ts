import type { IPaymentProviderConfigRepository } from "@/app/api/infra/data/repositories/paymentProviderConfig/IPaymentProviderConfigRepository"
import type { IPaymentProviderCredentialRepository } from "@/app/api/infra/data/repositories/paymentProviderCredential/IPaymentProviderCredentialRepository"
import {
  MAX_CREDENTIAL_VALUE_LENGTH,
  type CreateProviderInstanceBody,
  type ProviderAdaptersResponse,
  type ProviderInstanceView,
  type SetProviderCredentialBody,
} from "@/lib/payment-provider/admin-contract"
import { describeCredentialValue, type CredentialCipher } from "@/lib/payment-provider/credential-cipher"
import { credentialContext } from "@/lib/payment-provider/credential-resolver"
import {
  envFallbackNames,
  getAdapterDescriptor,
  isRequiredCredentialKey,
  isValidCredentialKey,
  listAdapterDescriptors,
} from "@/lib/payment-provider/credential-schema"
import {
  assertCanBeDefault,
  assertInstanceRoutingPolicy,
  assertSettingsApplicable,
  computeDefaultBlockers,
  pickPrimaryInstance,
  ProviderInstanceConflictError,
  ProviderInstanceNotFoundError,
  ProviderInstanceValidationError,
  toInstanceView,
  validateDisplayName,
  validateLogoAltText,
  validateLogoUrl,
  validateSettingsPatch,
  type ProviderInstanceRecord,
} from "@/lib/payment-provider/instance"
import { changedFields, snapshotInstance } from "@/lib/payment-provider/instance-audit"
import type { ProviderRoutingConfigPatch } from "@/lib/payment-provider/routing-config"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "@/lib/payment-provider/types"
import type {
  IPaymentProviderConfigService,
  ProviderAuditDraft,
  ProviderAuditSink,
  ProviderInstanceChange,
  UpdateProviderInstanceInput,
} from "./IPaymentProviderConfigService"

export type PaymentProviderConfigServiceOptions = {
  readonly getCipher: () => CredentialCipher
  /** Invalida o cache de credenciais depois de qualquer gravação. */
  readonly onChange: () => void
  /** Reserva de `cardEnabled` quando a instância não definiu (CARD_PAYMENTS_ENABLED). */
  readonly cardEnabledFallback: () => boolean
  /** Ambiente lido para a reserva de credenciais (padrão: process.env). */
  readonly env?: () => Readonly<Record<string, string | undefined>>
}

export class PaymentProviderConfigService implements IPaymentProviderConfigService {
  constructor(
    private readonly configs: IPaymentProviderConfigRepository,
    private readonly credentials: IPaymentProviderCredentialRepository,
    private readonly options: PaymentProviderConfigServiceOptions,
  ) {}

  async list(environment: PaymentProviderEnvironment): Promise<readonly ProviderInstanceView[]> {
    // Ordem determinística (nome, id): nunca depende de updatedAt nem da ordem física do banco.
    const records = [...(await this.configs.list(environment))].sort(compareInstances)
    const metas = await this.credentials.listMetaByConfigIds(records.map((record) => record.id))
    const fallback = this.options.cardEnabledFallback()
    return records.map((record) =>
      toInstanceView(
        record,
        metas.get(record.id) ?? [],
        fallback,
        this.envProvidedKeys(record, pickPrimaryInstance(records, record.provider)?.id === record.id),
      ),
    )
  }

  async get(id: string): Promise<ProviderInstanceView> {
    return this.toView(await this.requireInstance(id))
  }

  async resolveLegacyTargetId(
    provider: PaymentProviderKey,
    environment: PaymentProviderEnvironment,
  ): Promise<string> {
    const matches = (await this.configs.list(environment)).filter((item) => item.provider === provider)
    if (matches.length === 0) throw new ProviderInstanceNotFoundError()
    if (matches.length > 1) {
      throw new ProviderInstanceValidationError(
        "Há mais de uma instância para este provider; informe o id da instância",
      )
    }
    return matches[0].id
  }

  listAdapters(): ProviderAdaptersResponse {
    return {
      adapters: listAdapterDescriptors().map((adapter) => ({
        providerKey: adapter.providerKey,
        label: adapter.label,
        paymentCapable: adapter.paymentCapable,
        applicableSettings: adapter.applicableSettings,
        // Campos de política ficam de fora: a UI os controla por `settings`.
        credentialSchema: adapter.fields
          .filter((field) => !field.policy)
          .map(({ key, label, required, secret, hint }) => ({ key, label, required, secret, hint })),
      })),
    }
  }

  async create(input: CreateProviderInstanceBody): Promise<ProviderInstanceChange> {
    getAdapterDescriptor(input.providerKey)
    const externalAccountContext = input.externalAccountContext?.trim()
    if (!externalAccountContext) {
      throw new ProviderInstanceValidationError("O contexto da conta do provider é obrigatório")
    }
    const created = await this.configs.create({
      provider: input.providerKey,
      environment: input.environment,
      externalAccountContext,
      displayName: validateDisplayName(input.displayName),
      logoUrl: validateLogoUrl(input.logoUrl),
      logoAltText: validateLogoAltText(input.logoAltText),
    })
    this.options.onChange()
    return {
      view: await this.toView(created),
      audit: {
        action: "CREATE",
        entityId: created.id,
        operation: "provider_instance_created",
        before: null,
        after: { providerKey: created.provider, environment: created.environment, ...snapshotInstance(created) },
      },
    }
  }

  async update(input: UpdateProviderInstanceInput): Promise<ProviderInstanceChange> {
    const current = await this.requireInstance(input.id)
    const patch: ProviderRoutingConfigPatch = {
      expectedRevision: input.expectedRevision,
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      ...(input.externalAccountContext !== undefined
        ? { externalAccountContext: input.externalAccountContext }
        : {}),
      ...(input.rolloutState !== undefined ? { rolloutState: input.rolloutState } : {}),
      ...(input.killSwitch !== undefined ? { killSwitch: input.killSwitch } : {}),
    }
    const settings = input.settings !== undefined ? validateSettingsPatch(input.settings) : undefined
    if (settings) assertSettingsApplicable(current.provider, settings)
    // Só a promoção a padrão exige elegibilidade; os passos anteriores da ativação seguem livres.
    const credentialKeys = patch.isDefault === true && !current.isDefault ? await this.credentialCoverage(current) : null
    const updated = await this.configs.update({
      id: input.id,
      patch,
      metadata: {
        ...(input.displayName !== undefined ? { displayName: validateDisplayName(input.displayName) } : {}),
        ...(input.logoUrl !== undefined ? { logoUrl: validateLogoUrl(input.logoUrl) } : {}),
        ...(input.logoAltText !== undefined ? { logoAltText: validateLogoAltText(input.logoAltText) } : {}),
        ...(settings ? { settings } : {}),
      },
      assertNext: (next) => {
        assertInstanceRoutingPolicy(next)
        if (credentialKeys && next.isDefault) {
          assertCanBeDefault(computeDefaultBlockers(next, credentialKeys.stored, credentialKeys.env))
        }
      },
    })
    this.options.onChange()
    const before = snapshotInstance(current)
    const after = snapshotInstance(updated)
    const fields = changedFields(before, after)
    return {
      view: await this.toView(updated),
      audit: {
        action: "UPDATE",
        entityId: updated.id,
        operation: "provider_instance_updated",
        before,
        after,
        extra: { changedFields: fields },
      },
    }
  }

  async setCredential(
    input: SetProviderCredentialBody,
    actorProfileId: string | null,
    recordAudit?: ProviderAuditSink,
  ): Promise<ProviderInstanceChange> {
    const value = typeof input.value === "string" ? input.value.trim() : ""
    if (!isValidCredentialKey(input.key)) {
      throw new ProviderInstanceValidationError("Nome de credencial inválido")
    }
    if (!value) throw new ProviderInstanceValidationError("O valor da credencial não pode ser vazio")
    if (value.length > MAX_CREDENTIAL_VALUE_LENGTH) {
      throw new ProviderInstanceValidationError("O valor da credencial excede o tamanho máximo")
    }
    const instance = await this.requireInstance(input.configId)
    const previous = (await this.credentials.listMeta(instance.id)).find((meta) => meta.key === input.key)
    const cipher = this.options.getCipher()
    const described = describeCredentialValue(value)
    const rotated = Boolean(previous)
    const audit: ProviderAuditDraft = {
      action: rotated ? "UPDATE" : "CREATE",
      entityId: instance.id,
      operation: rotated ? "provider_credential_rotated" : "provider_credential_created",
      before: { key: input.key, isSet: rotated, last4: previous?.last4 ?? null },
      after: { key: input.key, isSet: true, last4: described.last4 },
      extra: { credentialKey: input.key },
    }
    // A trilha vem antes: sem ela o segredo não muda.
    await recordAudit?.(audit)
    await this.credentials.upsert({
      configId: instance.id,
      key: input.key,
      valueCiphertext: cipher.encrypt(value, credentialContext(instance.id, input.key)),
      keyId: cipher.keyId,
      last4: described.last4,
      fingerprint: described.fingerprint,
      updatedBy: actorProfileId,
    })
    this.options.onChange()
    return { view: await this.toView(instance), audit: recordAudit ? null : audit }
  }

  async deleteCredential(
    configId: string,
    key: string,
    recordAudit?: ProviderAuditSink,
  ): Promise<ProviderInstanceChange> {
    if (!isValidCredentialKey(key)) throw new ProviderInstanceValidationError("Nome de credencial inválido")
    const instance = await this.requireInstance(configId)
    assertCredentialRemovable(instance, key)
    const previous = (await this.credentials.listMeta(instance.id)).find((meta) => meta.key === key)
    const audit: ProviderAuditDraft | null = previous
      ? {
          action: "DELETE",
          entityId: instance.id,
          operation: "provider_credential_deleted",
          before: { key, isSet: true, last4: previous.last4 ?? null },
          after: { key, isSet: false, last4: null },
          extra: { credentialKey: key },
        }
      : null
    if (audit) await recordAudit?.(audit)
    const { deleted } = await this.credentials.delete(instance.id, key)
    if (deleted) this.options.onChange()
    return {
      view: await this.toView(instance),
      audit: deleted && !recordAudit ? audit : null,
    }
  }

  private async requireInstance(id: string): Promise<ProviderInstanceRecord> {
    const instance = await this.configs.findById(id)
    if (!instance) throw new ProviderInstanceNotFoundError()
    return instance
  }

  private async toView(record: ProviderInstanceRecord): Promise<ProviderInstanceView> {
    const metas = await this.credentials.listMeta(record.id)
    const siblings = await this.configs.list(record.environment)
    const isPrimary = pickPrimaryInstance(siblings, record.provider)?.id === record.id
    return toInstanceView(record, metas, this.options.cardEnabledFallback(), this.envProvidedKeys(record, isPrimary))
  }

  /** Credenciais gravadas e chaves obrigatórias cobertas pela reserva de ambiente (instância que viraria a principal). */
  private async credentialCoverage(record: ProviderInstanceRecord) {
    return {
      stored: await this.credentials.listMeta(record.id),
      env: this.envProvidedKeys(record, true),
    }
  }

  /**
   * Chaves obrigatórias que o ambiente cobre. A reserva compartilhada entre instâncias (Abacate) só
   * vale para a instância principal; a por contexto (Asaas) vale para a própria conta.
   */
  private envProvidedKeys(record: ProviderInstanceRecord, isPrimary: boolean): ReadonlySet<string> {
    const descriptor = getAdapterDescriptor(record.provider)
    if (descriptor.envFallbackSharedAcrossInstances && !isPrimary) return new Set()
    const env = this.options.env?.() ?? process.env
    const scope = { environment: record.environment, externalAccountContext: record.externalAccountContext }
    const covered = new Set<string>()
    for (const field of descriptor.fields) {
      if (!field.required) continue
      if (envFallbackNames(record.provider, field.key, scope).some((name) => env[name]?.trim())) {
        covered.add(field.key)
      }
    }
    return covered
  }
}

function compareInstances(a: ProviderInstanceRecord, b: ProviderInstanceRecord): number {
  return a.displayName.localeCompare(b.displayName, "pt-BR") || a.id.localeCompare(b.id)
}

/**
 * Credencial obrigatória de instância habilitada ou ACTIVE não pode ser apagada: a leitura cairia
 * em silêncio no ambiente (ou a instância ficaria sem segredo). Desabilite a instância antes.
 */
function assertCredentialRemovable(instance: ProviderInstanceRecord, key: string): void {
  if (!isRequiredCredentialKey(instance.provider, key)) return
  if (!instance.enabled && instance.rolloutState !== "ACTIVE") return
  throw new ProviderInstanceConflictError(
    "Não é possível remover uma credencial obrigatória de uma instância habilitada. Desabilite a instância antes.",
  )
}
