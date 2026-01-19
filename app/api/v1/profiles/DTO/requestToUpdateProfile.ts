/**
 * DTO for updating profile information
 * Allows updating email, phone, fullName, password, address fields, and cpfCnpj
 */
export interface RequestToUpdateProfile {
  fullName?: string;
  phone?: string;
  email?: string;
  password?: string;
  cpfCnpj?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  neighborhood?: string;
  complement?: string;
  city?: string;
  state?: string;
}

/**
 * Validates and sanitizes update profile request data
 * @param data - Raw request data
 * @returns Validated RequestToUpdateProfile or throws error
 */
export function validateUpdateProfileRequest(data: any): RequestToUpdateProfile {
  if (!data || typeof data !== 'object') {
    throw new Error('Request body must be a valid object');
  }

  const result: RequestToUpdateProfile = {};
  let hasValidField = false;

  // Validate fullName
  if (data.fullName !== undefined) {
    if (typeof data.fullName !== 'string') {
      throw new Error('Full name must be a string');
    }
    const trimmedFullName = data.fullName.trim();
    if (trimmedFullName.length === 0) {
      throw new Error('Full name cannot be empty');
    }
    if (trimmedFullName.length > 100) {
      throw new Error('Full name cannot exceed 100 characters');
    }
    result.fullName = trimmedFullName;
    hasValidField = true;
  }

  // Validate phone
  if (data.phone !== undefined) {
    if (typeof data.phone !== 'string') {
      throw new Error('Phone must be a string');
    }
    const trimmedPhone = data.phone.trim();
    if (trimmedPhone.length === 0) {
      throw new Error('Phone cannot be empty');
    }
    // Basic phone validation (allow digits, spaces, parentheses, dashes, plus)
    const phoneRegex = /^[\d\s\(\)\-\+]+$/;
    if (!phoneRegex.test(trimmedPhone)) {
      throw new Error('Phone must contain only digits, spaces, parentheses, dashes, and plus signs');
    }
    if (trimmedPhone.length > 20) {
      throw new Error('Phone cannot exceed 20 characters');
    }
    result.phone = trimmedPhone;
    hasValidField = true;
  }

  // Validate email
  if (data.email !== undefined) {
    if (typeof data.email !== 'string') {
      throw new Error('Email must be a string');
    }
    const trimmedEmail = data.email.trim().toLowerCase();
    if (trimmedEmail.length === 0) {
      throw new Error('Email cannot be empty');
    }
    // More robust email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      throw new Error('Email must be a valid email address');
    }
    if (trimmedEmail.length > 254) {
      throw new Error('Email cannot exceed 254 characters');
    }
    result.email = trimmedEmail;
    hasValidField = true;
  }

  // Validate password
  if (data.password !== undefined) {
    if (typeof data.password !== 'string') {
      throw new Error('Password must be a string');
    }
    // Para senha, permitir string vazia (remove senha) ou senha válida
    if (data.password.length > 0) {
      // Se fornecida, deve ter pelo menos 6 caracteres
      if (data.password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }
      if (data.password.length > 50) {
        throw new Error('Password cannot exceed 50 characters');
      }
    }
    result.password = data.password;
    hasValidField = true;
  }

  // Validate cpfCnpj
  if (data.cpfCnpj !== undefined) {
    if (data.cpfCnpj !== null && data.cpfCnpj !== '' && typeof data.cpfCnpj !== 'string') {
      throw new Error('CPF/CNPJ must be a string');
    }
    result.cpfCnpj = data.cpfCnpj || undefined;
    hasValidField = true;
  }

  // Validate postalCode
  if (data.postalCode !== undefined) {
    if (data.postalCode !== null && data.postalCode !== '' && typeof data.postalCode !== 'string') {
      throw new Error('Postal code must be a string');
    }
    result.postalCode = data.postalCode || undefined;
    hasValidField = true;
  }

  // Validate address
  if (data.address !== undefined) {
    if (data.address !== null && data.address !== '' && typeof data.address !== 'string') {
      throw new Error('Address must be a string');
    }
    result.address = data.address || undefined;
    hasValidField = true;
  }

  // Validate addressNumber
  if (data.addressNumber !== undefined) {
    if (data.addressNumber !== null && data.addressNumber !== '' && typeof data.addressNumber !== 'string') {
      throw new Error('Address number must be a string');
    }
    result.addressNumber = data.addressNumber || undefined;
    hasValidField = true;
  }

  // Validate neighborhood
  if (data.neighborhood !== undefined) {
    if (data.neighborhood !== null && data.neighborhood !== '' && typeof data.neighborhood !== 'string') {
      throw new Error('Neighborhood must be a string');
    }
    result.neighborhood = data.neighborhood || undefined;
    hasValidField = true;
  }

  // Validate complement
  if (data.complement !== undefined) {
    if (data.complement !== null && data.complement !== '' && typeof data.complement !== 'string') {
      throw new Error('Complement must be a string');
    }
    result.complement = data.complement || undefined;
    hasValidField = true;
  }

  // Validate city
  if (data.city !== undefined) {
    if (data.city !== null && data.city !== '' && typeof data.city !== 'string') {
      throw new Error('City must be a string');
    }
    result.city = data.city || undefined;
    hasValidField = true;
  }

  // Validate state
  if (data.state !== undefined) {
    if (data.state !== null && data.state !== '' && typeof data.state !== 'string') {
      throw new Error('State must be a string');
    }
    result.state = data.state || undefined;
    hasValidField = true;
  }

  // Check for invalid fields
  const allowedFields = ['fullName', 'phone', 'email', 'password', 'cpfCnpj', 'postalCode', 'address', 'addressNumber', 'neighborhood', 'complement', 'city', 'state'];
  const providedFields = Object.keys(data);
  const invalidFields = providedFields.filter(field => !allowedFields.includes(field));
  
  if (invalidFields.length > 0) {
    throw new Error(`Invalid fields provided: ${invalidFields.join(', ')}. Only fullName, phone, email, and password are allowed.`);
  }

  // At least one field must be provided
  if (!hasValidField) {
    throw new Error('At least one field (fullName, phone, email, or password) must be provided for update');
  }

  return result;
}

/**
 * Type guard to check if an object is a valid RequestToUpdateProfile
 */
export function isValidUpdateProfileRequest(obj: any): obj is RequestToUpdateProfile {
  try {
    validateUpdateProfileRequest(obj);
    return true;
  } catch {
    return false;
  }
}