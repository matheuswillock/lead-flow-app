"use client"

import { useEffect, useState } from "react"
import type { IPublicFormShareBaseUrlClientService } from "./IPublicFormShareBaseUrlClientService"
import { publicFormShareBaseUrlClientService } from "./PublicFormShareBaseUrlClientService"

/**
 * Cache module-level com dedupe, CHAVEADO POR TIME: o painel de formulários do
 * template e a lista de formulários montam/desmontam com frequência e a
 * resposta não muda dentro de uma sessão de edição. TTL curto para refletir
 * uma verificação de domínio recém-concluída sem exigir reload.
 *
 * A chave por time é obrigatória: `TeamSwitchingScreen` desmonta e remonta o
 * hook, mas estes globais sobrevivem à troca. Com cache global, trocar do time
 * A para o B devolvia o domínio de A e montava link de formulário de B num
 * host onde a guarda de tenancy responde 404.
 */
const CACHE_TTL_MS = 60_000

/** TTL curto após falha de rede — não trava o "copiar link" nem fixa o erro. */
const FAILURE_CACHE_TTL_MS = 5_000

type CacheEntry = { baseUrl: string | null; expiresAt: number }

const cacheByTeamId = new Map<string, CacheEntry>()
const inFlightByTeamId = new Map<string, Promise<string | null>>()

function readFreshCacheEntry(teamId: string): CacheEntry | null {
  const entry = cacheByTeamId.get(teamId)
  if (!entry || entry.expiresAt <= Date.now()) return null
  return entry
}

/**
 * Resolve a origem de compartilhamento do time, deduplicando requests
 * concorrentes do MESMO time. Exportado para teste.
 */
export async function resolvePublicFormShareBaseUrl(
  service: IPublicFormShareBaseUrlClientService,
  teamId: string,
): Promise<string | null> {
  const fresh = readFreshCacheEntry(teamId)
  if (fresh) return fresh.baseUrl

  const existing = inFlightByTeamId.get(teamId)
  if (existing) return existing

  const request = service
    .getVerifiedFormDomainBaseUrl()
    .then((baseUrl) => {
      cacheByTeamId.set(teamId, { baseUrl, expiresAt: Date.now() + CACHE_TTL_MS })
      return baseUrl
    })
    .catch(() => {
      // Falha de rede não pode travar o copiar link — cai no origin atual.
      const previous = cacheByTeamId.get(teamId)?.baseUrl ?? null
      cacheByTeamId.set(teamId, {
        baseUrl: previous,
        expiresAt: Date.now() + FAILURE_CACHE_TTL_MS,
      })
      return previous
    })
    .finally(() => {
      inFlightByTeamId.delete(teamId)
    })

  inFlightByTeamId.set(teamId, request)
  return request
}

/** Exposto para testes. */
export function clearPublicFormShareBaseUrlCache(): void {
  cacheByTeamId.clear()
  inFlightByTeamId.clear()
}

/**
 * Origem para montar links `/forms/{publicId}` exibidos/copiáveis no app:
 * domínio de formulários VERIFICADO do time quando existir, senão o origin
 * atual (comportamento anterior, `window.location.origin`).
 *
 * `teamId` é o time ATIVO: sem ele (bootstrap ainda carregando) o hook não
 * busca nada e devolve o origin atual, em vez de arriscar o domínio do time
 * anterior.
 */
export function usePublicFormShareBaseUrl(
  teamId: string | null | undefined,
  service: IPublicFormShareBaseUrlClientService = publicFormShareBaseUrlClientService,
): string {
  return usePublicFormShareBaseUrlInfo(teamId, service).baseUrl
}

export type PublicFormShareBaseUrlInfo = {
  /** Origem usada para montar o link copiável. */
  baseUrl: string
  /**
   * Hostname do domínio de formulários do time quando o link sai por ele;
   * `null` quando cai no origin da plataforma.
   *
   * A UI precisa DIZER isso: sem o rótulo, o host do link copiado muda em
   * silêncio assim que o time verifica um domínio, e quem copia não tem como
   * saber para onde o link aponta.
   */
  teamDomainHostname: string | null
}

/**
 * Mesma resolução de `usePublicFormShareBaseUrl`, mas expondo também QUAL
 * domínio está em uso — a UI precisa poder dizer isso em vez de trocar o host
 * do link em silêncio.
 */
export function usePublicFormShareBaseUrlInfo(
  teamId: string | null | undefined,
  service: IPublicFormShareBaseUrlClientService = publicFormShareBaseUrlClientService,
): PublicFormShareBaseUrlInfo {
  const [baseUrl, setBaseUrl] = useState<string | null>(
    teamId ? (readFreshCacheEntry(teamId)?.baseUrl ?? null) : null,
  )

  useEffect(() => {
    if (!teamId) {
      setBaseUrl(null)
      return
    }
    let active = true
    setBaseUrl(readFreshCacheEntry(teamId)?.baseUrl ?? null)
    void resolvePublicFormShareBaseUrl(service, teamId).then((resolved) => {
      if (active) setBaseUrl(resolved)
    })
    return () => {
      active = false
    }
  }, [service, teamId])

  if (baseUrl) {
    return { baseUrl, teamDomainHostname: safeHostname(baseUrl) }
  }
  return {
    baseUrl: typeof window !== "undefined" ? window.location.origin : "",
    teamDomainHostname: null,
  }
}

function safeHostname(baseUrl: string): string | null {
  try {
    return new URL(baseUrl).hostname
  } catch {
    return null
  }
}
