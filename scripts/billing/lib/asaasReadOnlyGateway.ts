/**
 * Gateway read-only da API Asaas — 30-E1 (inventário + re-censo).
 *
 * Garantia de segurança: a interface só expõe `fetchPage`, que sempre monta
 * a requisição com `method: "GET"` — não existe parâmetro para o chamador
 * escolher outro verbo, nem para enviar `body`. Escrita é impossível por
 * construção, não por convenção (nenhuma escrita na conta antiga pela app
 * fora da exceção documentada em E8 da SPEC 30).
 */

import { createAsaasClient, type AsaasClient } from "@/lib/asaas/asaas-client"
import { resolveAsaasAccount, type AsaasAccountId } from "@/lib/asaas/asaas-account"

export type AsaasListResponse<T> = {
  object: string
  hasMore: boolean
  totalCount: number
  limit: number
  offset: number
  data: T[]
}

export interface IAsaasReadOnlyGateway {
  readonly accountId: AsaasAccountId
  /**
   * Listagem paginada; o método opcional `fetchOne` também emite somente GET
   * para confirmar um ponteiro conhecido.
   */
  fetchPage<T>(path: string, offset: number, limit?: number): Promise<AsaasListResponse<T>>
  /** Busca uma entidade conhecida para confirmar ponteiros fora da listagem. */
  fetchOne?<T>(path: string): Promise<T | null>
}

const DEFAULT_PAGE_LIMIT = 100

export class AsaasReadOnlyGateway implements IAsaasReadOnlyGateway {
  readonly accountId: AsaasAccountId
  private readonly client: AsaasClient
  private readonly baseUrl: string

  constructor(accountId: AsaasAccountId) {
    this.accountId = accountId
    this.client = createAsaasClient(accountId)
    this.baseUrl = resolveAsaasAccount(accountId).baseUrl
  }

  async fetchPage<T>(
    path: string,
    offset: number,
    limit: number = DEFAULT_PAGE_LIMIT
  ): Promise<AsaasListResponse<T>> {
    const separator = path.includes("?") ? "&" : "?"
    const url = `${this.baseUrl}/api/v3${path}${separator}limit=${limit}&offset=${offset}`
    return this.client.request(url, { method: "GET" }) as Promise<AsaasListResponse<T>>
  }

  async fetchOne<T>(path: string): Promise<T | null> {
    const url = `${this.baseUrl}/api/v3${path}`
    try {
      return (await this.client.request(url, {
        method: "GET",
        suppressLegacy404Alert: true,
      })) as T
    } catch (error) {
      const statusCode =
        error && typeof error === "object" && "statusCode" in error
          ? (error as { statusCode?: unknown }).statusCode
          : undefined
      if (statusCode === 404) return null
      throw error
    }
  }
}

export function createAsaasReadOnlyGateway(accountId: AsaasAccountId): IAsaasReadOnlyGateway {
  return new AsaasReadOnlyGateway(accountId)
}

/**
 * Pagina um recurso Asaas inteiro (T-30.1). Função pura em relação ao
 * transporte — recebe o gateway já resolvido, nunca lê `process.env` nem
 * monta URL sozinha, o que a torna testável com um gateway mockado sem
 * tocar rede nem `fetch` global.
 */
export async function fetchAllPages<T>(
  gateway: IAsaasReadOnlyGateway,
  path: string,
  limit: number = DEFAULT_PAGE_LIMIT
): Promise<T[]> {
  const results: T[] = []
  let offset = 0

  while (true) {
    const page = await gateway.fetchPage<T>(path, offset, limit)
    results.push(...page.data)
    if (!page.hasMore) break
    offset += limit
  }

  return results
}
