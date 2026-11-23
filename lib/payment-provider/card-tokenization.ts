import { describeAbacateError } from "./abacate-js"

export type CardTokenizerPayer = {
  readonly name: string
  readonly email: string
  /** CPF ou CNPJ, com ou sem máscara. */
  readonly taxId: string
  readonly cellphone: string
}

/** Contrato que todo campo de cartão de provedor cumpre: o token vale uma cobrança e some em segundos. */
export type CardTokenizerHandle = {
  tokenize(payer: CardTokenizerPayer): Promise<{ token: string; lastFour: string }>
  readonly canTokenize: boolean
}

const GENERIC_MESSAGE = "Não foi possível validar o cartão. Confira os dados ou use outro cartão."

/** Mensagem para o operador a partir do erro do SDK do provedor que tokenizou. */
export function describeCardTokenizationError(provider: string | null, error: unknown): string {
  if (provider === "ABACATE_PAY") return describeAbacateError(error)
  return GENERIC_MESSAGE
}
