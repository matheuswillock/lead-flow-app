/**
 * Regras de numeração de telefone brasileiro (ANATEL) e normalização do
 * prefixo de código do país (+55/55) — isomórfico, sem `Bun.*`/APIs Node-only,
 * porque é a fonte única para as duas pontas do fix do bug 2026-09-01:
 * este PR liga a régua server-side de criação de lead (SPEC 40-E1;
 * `lib/public-forms/lead-identity.ts`), e o PR de frontend empilhado
 * (SPEC 41-E2) liga a máscara do campo do formulário público importando
 * ESTAS funções — nunca uma cópia da regra. Enquanto o PR de frontend não
 * mergear, o strip protege os canais que entregam 12-13 dígitos intactos ao
 * servidor (import, API, colagem em outros fluxos). Contexto do bug:
 * telefone digitado com "55" na frente vira DDD, desloca o número e trunca
 * o último dígito antes de qualquer validação.
 */

/** Celular: 11 dígitos (DDD + 9 do local), terceiro dígito sempre "9". */
export function isBrazilianMobilePhoneDigits(digits: string): boolean {
  return /^\d{11}$/.test(digits) && digits[2] === "9"
}

/** Fixo: DDD + 8 dígitos locais começando em 2-5 (ANATEL rejeita 0/1/6-9). */
export function isBrazilianLandlinePhoneDigits(digits: string): boolean {
  return /^\d{2}[2-5]\d{7}$/.test(digits)
}

export function isBrazilianContactPhoneDigits(digits: string): boolean {
  return isBrazilianMobilePhoneDigits(digits) || isBrazilianLandlinePhoneDigits(digits)
}

/**
 * Remove o prefixo "55" (código do país) de uma string de SÓ dígitos quando,
 * e só quando, o restante forma um DDD + número BR válidos.
 *
 * DDD 55 existe de verdade (Rio Grande do Sul): "55996326534" também começa
 * com "55", mas É o telefone (DDD 55 + celular 996326534), não um código de
 * país na frente de um DDD diferente. Por isso a entrada completa é checada
 * PRIMEIRO — telefone já válido nunca é alterado, mesmo quando também bate
 * com o padrão de prefixo. Só quando a entrada completa não é um telefone
 * válido é que a hipótese "os dois primeiros dígitos são o DDI" é testada, e
 * só vence se o que sobra for, por si só, um DDD + número válidos — nunca por
 * tamanho/posição cru.
 */
export function stripBrazilCountryCode(digits: string): string {
  if (isBrazilianContactPhoneDigits(digits)) return digits
  if (!digits.startsWith("55")) return digits
  const withoutCountryCode = digits.slice(2)
  return isBrazilianContactPhoneDigits(withoutCountryCode) ? withoutCountryCode : digits
}

/** Remove tudo que não é dígito e aplica `stripBrazilCountryCode`. */
export function normalizeBrazilianPhoneDigits(raw: string): string {
  return stripBrazilCountryCode(raw.replace(/\D/g, ""))
}
