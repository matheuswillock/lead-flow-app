import {
  CredentialCache,
  type CredentialSource,
  type InstanceSelector,
  type ResolvedCredentials,
  selectorKey,
} from "./credential-cache"
import { envFallbackNames, getAdapterDescriptor } from "./credential-schema"
import type { StoredProviderSettings } from "./instance"

type Env = Readonly<Record<string, string | undefined>>

export type StoredCredentialRow = { readonly key: string; readonly valueCiphertext: string }

export type ResolverInstance = {
  readonly id: string
  readonly externalAccountContext: string
  readonly settings: StoredProviderSettings
}

export type CredentialResolverDeps = {
  findInstance(
    selector: InstanceSelector,
  ): Promise<ResolverInstance | null>
  loadStored(configId: string): Promise<readonly StoredCredentialRow[]>
  /** Lança se não conseguir decifrar. */
  decrypt(payload: string, context: string): string
  env: () => Env
  cache: CredentialCache
  /** Log estruturado: nunca recebe valores, só nomes de chave e fonte. */
  log: (event: string, fields: Record<string, unknown>) => void
}

export type CredentialResolver = {
  resolve(selector: InstanceSelector): Promise<ResolvedCredentials>
  /** Cache (mesmo vencido) e, na falta dele, somente o ambiente. Nunca consulta o banco. */
  resolveSync(selector: InstanceSelector): ResolvedCredentials
}

export function credentialContext(configId: string, key: string): string {
  return `${configId}:${key}`
}

export function createCredentialResolver(deps: CredentialResolverDeps): CredentialResolver {
  const inFlight = new Map<string, Promise<ResolvedCredentials>>()
  return {
    async resolve(selector) {
      const cached = deps.cache.getFresh(selector)
      if (cached) return cached
      const key = selectorKey(selector)
      const pending = inFlight.get(key)
      if (pending) return pending
      const load = (async () => {
        try {
          const resolved = await loadFromDatabase(deps, selector)
          deps.cache.set(selector, resolved)
          logSources(deps, selector, resolved)
          return resolved
        } catch (error) {
          if (!(error instanceof CredentialReadError)) throw error
          const stale = deps.cache.peek(selector)
          deps.log("payment_provider_credentials_db_unavailable", {
            provider: selector.provider,
            environment: selector.environment,
            error: error.cause,
            servedFrom: stale ? "stale_cache" : "none",
          })
          if (stale) return stale
          throw error
        }
      })().finally(() => inFlight.delete(key))
      inFlight.set(key, load)
      return load
    },
    resolveSync(selector) {
      return deps.cache.peek(selector) ?? resolveFromEnvironment(selector, deps.env(), null, {})
    },
  }
}

/**
 * Distingue "chave ausente no banco" (bootstrap: cai no ambiente) de "erro ao ler o banco"
 * (NUNCA cai no ambiente: usa a última entrada boa do cache e, sem ela, lança — falha fechada).
 * Schema ainda não aplicado (tabela/coluna inexistente) equivale a "nada gravado".
 */
async function loadFromDatabase(
  deps: CredentialResolverDeps,
  selector: InstanceSelector,
): Promise<ResolvedCredentials> {
  let instance: ResolverInstance | null
  let stored: readonly StoredCredentialRow[] = []
  try {
    instance = await deps.findInstance(selector)
    if (instance) stored = await deps.loadStored(instance.id)
  } catch (error) {
    if (isSchemaNotApplied(error)) return resolveFromEnvironment(selector, deps.env(), null, {})
    throw new CredentialReadError(error)
  }
  if (!instance) return resolveFromEnvironment(selector, deps.env(), null, {})
  const dbValues: Record<string, string> = {}
  for (const row of stored) {
    // Credencial gravada e ilegível NÃO cai no ambiente: falha explícita (decrypt lança).
    dbValues[row.key] = deps.decrypt(row.valueCiphertext, credentialContext(instance.id, row.key))
  }
  return resolveFromEnvironment(selector, deps.env(), instance, dbValues)
}

export class CredentialReadError extends Error {
  constructor(cause: unknown) {
    super("Não foi possível ler as credenciais do provider")
    this.name = "CredentialReadError"
    this.cause = cause instanceof Error ? cause.name : "unknown"
  }
}

function isSchemaNotApplied(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code
  return code === "P2021" || code === "P2022"
}

/** Merge por CHAVE: banco primeiro; a variável de ambiente só preenche o que o banco não tem. */
function resolveFromEnvironment(
  selector: InstanceSelector,
  env: Env,
  instance: ResolverInstance | null,
  dbValues: Readonly<Record<string, string>>,
): ResolvedCredentials {
  const values: Record<string, string> = { ...dbValues }
  const sources: Record<string, CredentialSource> = {}
  for (const key of Object.keys(dbValues)) sources[key] = "db"
  const scope = {
    environment: selector.environment,
    externalAccountContext: selector.externalAccountContext ?? instance?.externalAccountContext ?? "",
  }
  for (const field of getAdapterDescriptor(selector.provider).fields) {
    if (field.key in values) continue
    for (const name of envFallbackNames(selector.provider, field.key, scope)) {
      const candidate = env[name]
      if (candidate?.trim()) {
        values[field.key] = candidate
        sources[field.key] = "env"
        break
      }
    }
  }
  return Object.freeze({
    instanceId: instance?.id ?? null,
    values: Object.freeze(values),
    sources: Object.freeze(sources),
    settings: instance?.settings ?? {},
  })
}

function logSources(
  deps: CredentialResolverDeps,
  selector: InstanceSelector,
  resolved: ResolvedCredentials,
): void {
  deps.log("payment_provider_credentials_resolved", {
    provider: selector.provider,
    environment: selector.environment,
    externalAccountContext: selector.externalAccountContext ?? null,
    instanceId: resolved.instanceId,
    sources: resolved.sources,
  })
}
