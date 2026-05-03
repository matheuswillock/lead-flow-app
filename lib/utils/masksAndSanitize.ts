/**
 * Retorna o documento formatado com máscara de CPF ou CNPJ, dependendo do número de dígitos
 * @param value - Valor do documento (CPF ou CNPJ) como string, pode conter caracteres não numéricos
 * @returns Documento formatado com máscara ou string vazia se o valor for null
 * Exemplo de formatação:
 * - CPF: 12345678901 -> 123.456.789-01
 * - CNPJ: 12345678000199 -> 12.345.678/0001-99
 */
export function formatDocumentInput(value: string | null): string {
  if (value === null) return ""

  const digits = sanitizeDocumentDigits(value)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  if (digits.length <= 11)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
  if (digits.length <= 14)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
  return value
}

/**
 * Remove todos os caracteres não numéricos do documento e limita a 14 dígitos (CPF ou CNPJ)
 * @param value - Valor do documento como string, pode conter caracteres não numéricos
 * @return String contendo apenas os dígitos do documento, limitada a 14 caracteres
 * Exemplo:
 * - "123.456.789-01" -> "12345678901"
 * - "12.345.678/0001-99" -> "12345678000199"
 */
export function sanitizeDocumentDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 14)
}


