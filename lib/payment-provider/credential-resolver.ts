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
        const resolved = await loadFromDatabaseWithFallback(deps, selector)
        deps.cache.set(selector, resolved)
        logSources(deps, selector, resolved)
        return resolved
      })().finally(() => inFlight.delete(key))
      inFlight.set(key, load)
      return load
    },
    resolveSync(selector) {
      return deps.cache.peek(selector) ?? resolveFromEnvironment(selector, deps.env(), null, {})
    },
  }
}

async function loadFromDatabaseWithFallback(
  deps: CredentialResolverDeps,
  selector: InstanceSelector,
): Promise<ResolvedCredentials> {
  let instance: Awaited<ReturnType<CredentialResolverDeps["findInstance"]>>
  let stored: readonly StoredCredentialRow[] = []
  try {
    instance = await deps.findInstance(selector)
    if (instance) stored = await deps.loadStored(instance.id)
  } catch (error) {
    // Banco indisponível (ou migration ainda não aplicada): a reserva no ambiente mantém o serviço.
    deps.log("payment_provider_credentials_db_unavailable", {
      provider: selector.provider,
      environment: selector.environment,
      error: error instanceof Error ? error.name : "unknown",
    })
    return resolveFromEnvironment(selector, deps.env(), null, {})
  }
  if (!instance) return resolveFromEnvironment(selector, deps.env(), null, {})
  const dbValues: Record<string, string> = {}
  for (const row of stored) {
    // Credencial gravada e ilegível NÃO cai no ambiente: falha explícita (decrypt lança).
    dbValues[row.key] = deps.decrypt(row.valueCiphertext, credentialContext(instance.id, row.key))
  }
  return resolveFromEnvironment(selector, deps.env(), instance, dbValues)
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
