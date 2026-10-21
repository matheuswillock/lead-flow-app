import type { StoredProviderSettings } from "./instance"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "./types"

export type CredentialSource = "db" | "env"

export type InstanceSelector = {
  readonly provider: PaymentProviderKey
  readonly environment: PaymentProviderEnvironment
  /** Ausente: usa a instância principal (padrão, depois habilitada, depois a mais antiga). */
  readonly externalAccountContext?: string
}

export type ResolvedCredentials = {
  readonly instanceId: string | null
  readonly values: Readonly<Record<string, string>>
  readonly sources: Readonly<Record<string, CredentialSource>>
  readonly settings: StoredProviderSettings
}

export const CREDENTIAL_CACHE_TTL_MS = 30_000

export function selectorKey(selector: InstanceSelector): string {
  return `${selector.provider}|${selector.environment}|${selector.externalAccountContext ?? "*"}`
}

type Entry = { readonly value: ResolvedCredentials; readonly expiresAt: number }

/** Cache curto em memória. Leitura síncrona é permitida mesmo vencida (melhor que nada). */
export class CredentialCache {
  private readonly entries = new Map<string, Entry>()
  private refreshHook: ((selector: InstanceSelector) => void) | null = null

  constructor(
    private readonly ttlMs: number = CREDENTIAL_CACHE_TTL_MS,
    private readonly now: () => number = () => Date.now(),
  ) {}

  getFresh(selector: InstanceSelector): ResolvedCredentials | undefined {
    const entry = this.entries.get(selectorKey(selector))
    return entry && entry.expiresAt > this.now() ? entry.value : undefined
  }

  peek(selector: InstanceSelector): ResolvedCredentials | undefined {
    return this.entries.get(selectorKey(selector))?.value
  }

  set(selector: InstanceSelector, value: ResolvedCredentials): void {
    this.entries.set(selectorKey(selector), { value, expiresAt: this.now() + this.ttlMs })
  }

  /**
   * Leitura síncrona para quem não pode aguardar o banco: devolve o que houver (mesmo vencido) e,
   * se não estiver fresco, dispara a atualização em segundo plano (stale-while-revalidate).
   */
  peekAndRefresh(selector: InstanceSelector): ResolvedCredentials | undefined {
    if (!this.getFresh(selector)) this.refreshHook?.(selector)
    return this.peek(selector)
  }

  setRefreshHook(hook: ((selector: InstanceSelector) => void) | null): void {
    this.refreshHook = hook
  }

  /** Chamado em toda gravação de credencial ou configuração. */
  invalidateAll(): void {
    this.entries.clear()
  }
}

export const credentialCache = new CredentialCache()
