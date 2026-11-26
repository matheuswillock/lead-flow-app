/**
 * Bloqueio do botão de pagar até o aceite dos termos (D7). O servidor segue sendo a autoridade
 * (`termsAccepted: true` é exigido na criação do pedido); aqui só se evita o clique que falharia.
 */

/** Pedido criado: o aceite foi enviado na criação (o servidor o exige), então o retry não pede de novo. */
export function isTermsAcceptanceRequired(input: { hasOrder: boolean }): boolean {
  return !input.hasOrder
}

export function isPayBlockedByTerms(input: { termsAccepted: boolean; hasOrder: boolean }): boolean {
  return isTermsAcceptanceRequired(input) && !input.termsAccepted
}

/** Motivo do botão desabilitado, ao lado dele (desktop). */
export function termsHintFor(isCard: boolean): string {
  return isCard ? "Aceite os termos para pagar com cartão." : "Aceite os termos para gerar o QR Code PIX."
}

/** Motivo do botão desabilitado na barra fixa do celular, que tem pouco espaço. Tocar nele leva à caixa. */
export const MOBILE_TERMS_HINT = "Aceite os termos para pagar."
