/**
 * DTO for updating profile information
 * Allows updating email, phone, fullName, and password fields
 */
export interface RequestToUpdateProfile {
  fullName?: string;
  phone?: string;
  email?: string;
  password?: string;
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

  // Check for invalid fields
  const allowedFields = ['fullName', 'phone', 'email', 'password'];
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