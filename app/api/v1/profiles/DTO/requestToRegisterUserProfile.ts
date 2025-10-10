export interface RequestToRegisterUserProfile {
  email: string;
  password: string;
  fullname: string;
  phone: string;
  asaasCustomerId?: string;
  subscriptionId?: string;
  cpfCnpj?: string;
  subscriptionStatus?: string;
}

/**
 * Valida os dados de registro de perfil de usuário
 * @param data - Dados a serem validados
 * @returns Os dados validados
 * @throws Error se algum campo for inválido
 */
export function validateRegisterProfileRequest(data: any): RequestToRegisterUserProfile {
  // Verificar se data existe
  if (!data || typeof data !== 'object') {
    throw new Error('Request body is required and must be an object');
  }

  const errors: string[] = [];

  // Validação do email
  if (data.email === undefined || data.email === null) {
    errors.push('Email is required');
  } else if (typeof data.email !== 'string') {
    errors.push('Email must be a string');
  } else if (data.email.trim().length === 0) {
    errors.push('Email cannot be empty');
  } else if (data.email.length > 100) {
    errors.push('Email must be at most 100 characters long');
  } else {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(data.email)) {
      errors.push('Email must be a valid email address');
    }
  }

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

  // Validação do nome completo
  if (data.fullname === undefined || data.fullname === null) {
    errors.push('Full name is required');
  } else if (typeof data.fullname !== 'string') {
    errors.push('Full name must be a string');
  } else if (data.fullname.trim().length === 0) {
    errors.push('Full name cannot be empty');
  } else if (data.fullname.length < 2) {
    errors.push('Full name must be at least 2 characters long');
  } else if (data.fullname.length > 100) {
    errors.push('Full name must be at most 100 characters long');
  } else {
    // Validação de nome: apenas letras, espaços, acentos e hífens
    const nameRegex = /^[a-zA-ZÀ-ÿ\s\-']+$/;
    if (!nameRegex.test(data.fullname)) {
      errors.push('Full name can only contain letters, spaces, hyphens and apostrophes');
    }
  }

  // Validação do telefone
  if (data.phone === undefined || data.phone === null) {
    errors.push('Phone is required');
  } else if (typeof data.phone !== 'string') {
    errors.push('Phone must be a string');
  } else if (data.phone.trim().length === 0) {
    errors.push('Phone cannot be empty');
  } else {
    // Remover espaços e caracteres especiais para validação
    const cleanPhone = data.phone.replace(/[\s\-\(\)]/g, '');
    
    // Validação de telefone brasileiro (com ou sem código do país)
    const phoneRegex = /^(\+55|55)?[1-9][0-9]{8,10}$/;
    if (!phoneRegex.test(cleanPhone)) {
      errors.push('Phone must be a valid Brazilian phone number (e.g., +5511999999999 or 11999999999)');
    }
  }

  // Se há erros, lançar exceção
  if (errors.length > 0) {
    throw new Error(errors.join(', '));
  }

  // Retornar dados validados
  return {
    email: data.email.trim().toLowerCase(),
    password: data.password,
    fullname: data.fullname.trim(),
    phone: data.phone.trim()
  };
}
