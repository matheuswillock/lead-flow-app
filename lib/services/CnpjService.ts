/** Dados públicos da empresa devolvidos pela consulta de CNPJ. */
export interface CompanyLookup {
  legalName: string
  tradeName: string | null
}

export type CnpjFetcher = (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => Promise<Response>

type BrasilApiCnpj = {
  razao_social?: unknown
  nome_fantasia?: unknown
}

function cleanName(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

/**
 * Consulta pública de CNPJ (BrasilAPI), chamada direto do navegador como a consulta de CEP. Só
 * lê dados públicos da empresa; qualquer falha devolve `null` e o cliente preenche à mão.
 */
export class CnpjService {
  private static readonly BASE_URL = "https://brasilapi.com.br/api/cnpj/v1"

  static async consultar(
    cnpj: string,
    fetcher: CnpjFetcher = (input, init) => fetch(input, init),
  ): Promise<CompanyLookup | null> {
    const digits = cnpj.replace(/\D/g, "")
    if (digits.length !== 14) return null

    try {
      const response = await fetcher(`${this.BASE_URL}/${digits}`)
      if (!response.ok) return null
      const data = (await response.json()) as BrasilApiCnpj
      const legalName = cleanName(data.razao_social)
      if (!legalName) return null
      return { legalName, tradeName: cleanName(data.nome_fantasia) }
    } catch {
      return null
    }
  }
}
