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
