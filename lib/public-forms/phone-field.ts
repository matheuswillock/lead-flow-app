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
import { isBrazilianContactPhoneDigits, stripBrazilCountryCode } from "@/lib/phone/normalize-brazilian-phone"
import { formatPhoneBR, phoneDigitCount } from "./masks"

/**
 * A régua estrita do gate (`stripBrazilCountryCode`) só remove o "55" quando o
 * RESTO já é um telefone válido — correto no servidor, que sempre recebe o
 * valor final. O campo controlado é diferente: cada tecla realimenta o valor
 * exibido, e no celular com DDI (13 dígitos, caso Nathany) o 12º dígito forma
 * um resto de 10 que ainda não é válido; sem tolerância a digitação em
 * andamento, a máscara corta de volta para 11 e o 12º dígito é engolido a
 * cada tecla — o 13º nunca acumula. Regra tolerante DO CAMPO (nunca do gate):
 * 12+ dígitos começando com "55" cujo valor completo não é um telefone válido
 * têm o DDI removido mesmo com o resto ainda incompleto. Telefone completo
 * válido (ex.: DDD 55 gaúcho) continua vencendo primeiro e nunca é alterado.
 */
function stripCountryCodeTolerantForTyping(digits: string): string {
  const strictlyStripped = stripBrazilCountryCode(digits)
  if (strictlyStripped !== digits) return strictlyStripped
  // Fat-finger após telefone completo: se os 11 primeiros dígitos JÁ formam um
  // telefone válido (ex.: celular gaúcho "(55) 99632-6534" + uma tecla extra),
  // o excedente é truncado — o mesmo destino que a máscara dá a qualquer outro
  // DDD — e o número legítimo nunca é reinterpretado como DDI + resto.
  // EXCEÇÃO: se o resto após o "55" parece um celular em digitação (10 dígitos
  // com o 3º = 9, ex.: DDI + DDD 91–99 de Belém aos 12 dígitos), a hipótese
  // DDI vence — truncar aqui gravaria um DDD 55 + número errado que PASSA na
  // validação. A tecla seguinte completa o celular e resolve a ambiguidade.
  if (digits.length >= 12 && isBrazilianContactPhoneDigits(digits.slice(0, 11))) {
    const remainderAfterCountryCode = digits.slice(2)
    const remainderLooksLikeMobileMidTyping =
      digits.startsWith("55") &&
      remainderAfterCountryCode.length === 10 &&
      remainderAfterCountryCode[2] === "9"
    if (!remainderLooksLikeMobileMidTyping) {
      return digits.slice(0, 11)
    }
  }
  const isMidTypingWithCountryCode =
    digits.startsWith("55") && digits.length >= 12 && !isBrazilianContactPhoneDigits(digits)
  return isMidTypingWithCountryCode ? digits.slice(2) : digits
}

/**
 * Aplica a remoção do código do país ANTES da máscara BR — é o único ponto
 * que salva o dígito que a máscara, sozinha, cortaria. Usar tanto no
 * `onChange` quanto no `onBlur` do campo `phone`.
 */
export function normalizeAndMaskPhoneInput(raw: string): string {
  return formatPhoneBR(stripCountryCodeTolerantForTyping(raw.replace(/\D/g, "")))
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

type LeadPhoneQuestionCandidate = {
  type: string
  mappingTarget?: string | null
  mappingKey?: string | null
}

/**
 * O gate identifica o telefone do lead pela pergunta mapeada para
 * `native_field.phone` (`lib/public-forms/lead-identity.ts`) — não pela
 * primeira pergunta de tipo `phone`. Um formulário pode ter um telefone de
 * recado (custom_field) ANTES do telefone do lead; olhar só o tipo faria um
 * recado válido suprimir o aviso do telefone que realmente decide o lead.
 * Fallback para a primeira pergunta `phone` quando nenhuma está mapeada.
 */
export function findLeadPhoneQuestion<T extends LeadPhoneQuestionCandidate>(
  questions: readonly T[],
): T | null {
  return (
    questions.find(
      (question) =>
        question.type === "phone" &&
        question.mappingTarget === "native_field" &&
        question.mappingKey === "phone",
    ) ??
    questions.find((question) => question.type === "phone") ??
    null
  )
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
