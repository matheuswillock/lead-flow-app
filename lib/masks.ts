/**
 * Utilitários para máscaras de input
 * Máscaras são aplicadas apenas na UI, os valores são armazenados sem formatação
 */

/**
 * Aplica máscara de telefone brasileiro
 * Formato: (11) 99999-9999 ou (11) 9999-9999
 */
export function maskPhone(value: string): string {
  if (!value) return '';
  
  // Remove tudo que não é número
  const numbers = value.replace(/\D/g, '');
  
  // Mantém no máximo 11 dígitos a partir do DDD (remove DDI 55 quando presente)
  const limited = numbers.length <= 11 ? numbers : numbers.slice(-11);
  
  // Aplica a máscara
  if (limited.length <= 10) {
    // Formato: (11) 9999-9999
    return limited
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  } else {
    // Formato: (11) 99999-9999
    return limited
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2');
  }
}

/**
 * Aplica máscara de CEP
 * Formato: 12345-678
 */
export function maskCEP(value: string): string {
  if (!value) return '';
  
  // Remove tudo que não é número
  const numbers = value.replace(/\D/g, '');
  
  // Limita a 8 dígitos
  const limited = numbers.slice(0, 8);
  
  // Aplica a máscara
  return limited.replace(/^(\d{5})(\d)/, '$1-$2');
}

/**
 * Aplica máscara de número de cartão de crédito
 * Formato: 1111 2222 3333 4444
 */
export function maskCardNumber(value: string): string {
  if (!value) return '';

  const numbers = value.replace(/\D/g, '').slice(0, 19);

  return numbers.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

/**
 * Remove todos os caracteres não numéricos
 * Usado antes de enviar para os services
 */
export function unmask(value: string): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

/**
 * Valida se é um CPF válido
 */
export function isValidCPF(cpf: string): boolean {
  const numbers = unmask(cpf);
  
  if (numbers.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(numbers)) return false;
  
  // Validação do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(numbers.charAt(i)) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(numbers.charAt(9))) return false;
  
  // Validação do segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(numbers.charAt(i)) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(numbers.charAt(10))) return false;
  
  return true;
}

/**
 * Valida se é um CNPJ válido
 */
export function isValidCNPJ(cnpj: string): boolean {
  const numbers = unmask(cnpj);
  
  if (numbers.length !== 14) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(numbers)) return false;
  
  // Validação do primeiro dígito verificador
  let sum = 0;
  let weight = 5;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(numbers.charAt(i)) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  let digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (digit !== parseInt(numbers.charAt(12))) return false;
  
  // Validação do segundo dígito verificador
  sum = 0;
  weight = 6;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(numbers.charAt(i)) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (digit !== parseInt(numbers.charAt(13))) return false;
  
  return true;
}

/**
 * Valida telefone brasileiro
 * Aceita 10 ou 11 dígitos
 */
export function isValidPhone(phone: string): boolean {
  const numbers = unmask(phone);
  return numbers.length === 10 || numbers.length === 11;
}


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

/**
 * Normaliza telefone de lead para armazenamento/UI: somente DDD + número (máx. 11).
 * Remove DDI (ex.: 55) quando o valor vier como E.164 / webhook WhatsApp.
 * Ex.: "55 11 99999-9999" | "5511999999999" → "11999999999"
 */
export function normalizeLeadPhoneDigits(value: string): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 11) return digits;
  return digits.slice(-11);
}

/**
 * Retorna o documento formatado para RG/CPF (somente dígitos)
 * @param value - Documento com ou sem máscara
 * @returns Documento com máscara de RG (até 9) ou CPF (11)
 */
export function formatRgCpfInput(value: string | null): string {
  if (value === null) return "";

  const digits = sanitizeRgCpfDigits(value);

  // CPF
  if (digits.length > 9) {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  // RG
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}-${digits.slice(8)}`;
}

/**
 * Sanitiza documento RG/CPF (somente dígitos)
 */
export function sanitizeRgCpfDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}
