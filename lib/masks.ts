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
  
  // Limita a 11 dígitos
  const limited = numbers.slice(0, 11);
  
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
 * Aplica máscara de CPF
 * Formato: 111.111.111-11
 */
export function maskCPF(value: string): string {
  if (!value) return '';
  
  // Remove tudo que não é número
  const numbers = value.replace(/\D/g, '');
  
  // Limita a 11 dígitos
  const limited = numbers.slice(0, 11);
  
  // Aplica a máscara
  return limited
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

/**
 * Aplica máscara de CNPJ
 * Formato: 11.111.111/1111-11
 */
export function maskCNPJ(value: string): string {
  if (!value) return '';
  
  // Remove tudo que não é número
  const numbers = value.replace(/\D/g, '');
  
  // Limita a 14 dígitos
  const limited = numbers.slice(0, 14);
  
  // Aplica a máscara
  return limited
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

/**
 * Aplica máscara de CPF ou CNPJ automaticamente
 * Detecta o tipo baseado no comprimento
 */
export function maskCPFOrCNPJ(value: string): string {
  if (!value) return '';
  
  // Remove tudo que não é número
  const numbers = value.replace(/\D/g, '');
  
  // Se tem mais de 11 dígitos, é CNPJ
  if (numbers.length > 11) {
    return maskCNPJ(value);
  } else {
    return maskCPF(value);
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
