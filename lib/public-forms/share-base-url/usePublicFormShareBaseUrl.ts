"use client"

import { useEffect, useState } from "react"
import type { IPublicFormShareBaseUrlClientService } from "./IPublicFormShareBaseUrlClientService"
import { publicFormShareBaseUrlClientService } from "./PublicFormShareBaseUrlClientService"

/**
 * Cache module-level com dedupe: o painel de formulários do template e a
 * lista de formulários montam/desmontam com frequência e a resposta não muda
 * dentro de uma sessão de edição. TTL curto para refletir uma verificação de
 * domínio recém-concluída sem exigir reload.
 */
const CACHE_TTL_MS = 60_000

let cachedBaseUrl: string | null = null
let cacheExpiresAt = 0
let inFlight: Promise<string | null> | null = null

async function resolveShareBaseUrl(
  service: IPublicFormShareBaseUrlClientService,
): Promise<string | null> {
  if (cacheExpiresAt > Date.now()) return cachedBaseUrl
  inFlight ??= service
    .getVerifiedFormDomainBaseUrl()
    .then((baseUrl) => {
      cachedBaseUrl = baseUrl
      cacheExpiresAt = Date.now() + CACHE_TTL_MS
      return baseUrl
    })
    .catch(() => {
      // Falha de rede não pode travar o copiar link — cai no origin atual.
      cacheExpiresAt = Date.now() + 5_000
      return cachedBaseUrl
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

/** Exposto para testes. */
export function clearPublicFormShareBaseUrlCache(): void {
  cachedBaseUrl = null
  cacheExpiresAt = 0
  inFlight = null
}

/**
 * Origem para montar links `/forms/{publicId}` exibidos/copiáveis no app:
 * domínio de formulários VERIFICADO do time quando existir, senão o origin
 * atual (comportamento anterior, `window.location.origin`).
 */
export function usePublicFormShareBaseUrl(
  service: IPublicFormShareBaseUrlClientService = publicFormShareBaseUrlClientService,
): string {
  return usePublicFormShareBaseUrlInfo(service).baseUrl
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

export function usePublicFormShareBaseUrlInfo(
  service: IPublicFormShareBaseUrlClientService = publicFormShareBaseUrlClientService,
): PublicFormShareBaseUrlInfo {
  const [baseUrl, setBaseUrl] = useState<string | null>(
    cacheExpiresAt > Date.now() ? cachedBaseUrl : null,
  )

  useEffect(() => {
    let active = true
    void resolveShareBaseUrl(service).then((resolved) => {
      if (active) setBaseUrl(resolved)
    })
    return () => {
      active = false
    }
  }, [service])

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
