/**
 * Comportamento do campo `phone` do formulário público — normalização de
 * entrada, validação inline e a regra de "avisa uma vez, envia na segunda"
 * do submit. Ver bug 2026-09-01: `formatPhoneBR` sozinho trata "+55"/"55"
 * digitado antes do DDD como se fosse o próprio DDD, desloca o número e
 * trunca o último dígito antes de qualquer validação — irrecuperável depois
 * de gravado. Reusa a MESMA régua do gate (`lib/phone/normalize-brazilian-phone.ts`)
 * para nunca divergir: se o campo aprovasse um valor que o gate descarta, o
 * lead nasceria "válido" no navegador e sumiria no servidor de novo.
 */
import { isBrazilianContactPhoneDigits, normalizeBrazilianPhoneDigits } from "@/lib/phone/normalize-brazilian-phone"
import { formatPhoneBR, phoneDigitCount } from "./masks"

/**
 * Aplica a régua compartilhada de remoção do código do país ANTES da máscara
 * BR — é o único ponto que salva o dígito que a máscara, sozinha, cortaria.
 * Usar tanto no `onChange` quanto no `onBlur` do campo `phone`.
 */
export function normalizeAndMaskPhoneInput(raw: string): string {
  return formatPhoneBR(normalizeBrazilianPhoneDigits(raw))
}

export const PHONE_FIELD_INLINE_ERROR_MESSAGE =
  "Confira o telefone: use DDD + número (ex.: (11) 91234-5678). Se digitou com +55, removemos automaticamente."

/**
 * Vazio é considerado válido aqui — obrigatoriedade já é responsabilidade de
 * `validateAnswer`/`validateAnswerIssue` (`lib/public-forms/engine.ts`). Esta
 * função só julga o formato de um valor preenchido, pela régua ANATEL do gate.
 */
export function isValidPhoneFieldValue(value: unknown): boolean {
  const raw = String(value ?? "")
  if (!phoneDigitCount(raw)) return true
  return isBrazilianContactPhoneDigits(raw.replace(/\D/g, ""))
}

export function getPhoneFieldInlineError(value: unknown): string | null {
  return isValidPhoneFieldValue(value) ? null : PHONE_FIELD_INLINE_ERROR_MESSAGE
}

/**
 * A régua de lead não é régua de submissão (decisão do owner, adenda 41-E2):
 * telefone inválido barra o PRIMEIRO clique em Enviar — para o visitante ver
 * o aviso e ter a chance de corrigir — mas nunca o segundo. Histórico e
 * telemetria valem mesmo sem lead.
 */
export function shouldBlockFirstPhoneSubmitAttempt({
  value,
  alreadyWarnedOnce,
}: {
  value: unknown
  alreadyWarnedOnce: boolean
}): boolean {
  return !isValidPhoneFieldValue(value) && !alreadyWarnedOnce
}
