/**
 * Interface para solicitação de atualização de senha
 */
export interface RequestToUpdatePassword {
  password: string;
}

/**
 * Valida os dados de atualização de senha
 * @param data - Dados a serem validados
 * @returns Os dados validados
 * @throws Error se algum campo for inválido
 */
export function validateUpdatePasswordRequest(data: any): RequestToUpdatePassword {
  // Verificar se data existe
  if (!data || typeof data !== 'object') {
    throw new Error('Request body is required and must be an object');
  }

  const errors: string[] = [];

  // Validação da senha
  if (data.password === undefined || data.password === null) {
    errors.push('Password is required');
  } else if (typeof data.password !== 'string') {
    errors.push('Password must be a string');
  } else if (data.password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  } else if (data.password.length > 50) {
    errors.push('Password must be at most 50 characters long');
  } else {
    // Validação de senha forte: pelo menos 1 letra maiúscula, 1 número e 1 caractere especial
    const hasUpperCase = /[A-Z]/.test(data.password);
    const hasNumber = /\d/.test(data.password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(data.password);
    
    if (!hasUpperCase) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!hasNumber) {
      errors.push('Password must contain at least one number');
    }
    
    if (!hasSpecialChar) {
      errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{};\':"\\|,.<>\/?)');
    }
  }

  // Se há erros, lançar exceção
  if (errors.length > 0) {
    throw new Error(errors.join(', '));
  }

  // Retornar dados validados
  return {
    password: data.password
  };
}