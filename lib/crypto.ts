// lib/crypto.ts - Utilitário para criptografia de dados no sessionStorage

/**
 * Criptografa dados usando Base64 + XOR simples
 * Nota: Para produção, considere usar crypto-js ou similar
 */
export function encryptData(data: any): string {
  const jsonString = JSON.stringify(data);
  const key = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'lead-flow-default-key-2025';
  
  // XOR encryption
  let encrypted = '';
  for (let i = 0; i < jsonString.length; i++) {
    const charCode = jsonString.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    encrypted += String.fromCharCode(charCode);
  }
  
  // Encode to Base64
  return btoa(encrypted);
}

/**
 * Descriptografa dados
 */
export function decryptData<T>(encryptedData: string): T | null {
  try {
    const key = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'lead-flow-default-key-2025';
    
    // Decode from Base64
    const encrypted = atob(encryptedData);
    
    // XOR decryption
    let decrypted = '';
    for (let i = 0; i < encrypted.length; i++) {
      const charCode = encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      decrypted += String.fromCharCode(charCode);
    }
    
    return JSON.parse(decrypted) as T;
  } catch (error) {
    console.error('[Crypto] Erro ao descriptografar:', error);
    return null;
  }
}

/**
 * Salva dados criptografados no sessionStorage
 */
export function saveEncryptedData(key: string, data: any): void {
  const encrypted = encryptData(data);
  sessionStorage.setItem(key, encrypted);
}

/**
 * Recupera dados criptografados do sessionStorage
 */
export function getEncryptedData<T>(key: string): T | null {
  const encrypted = sessionStorage.getItem(key);
  if (!encrypted) return null;
  
  return decryptData<T>(encrypted);
}

/**
 * Remove dados do sessionStorage
 */
export function removeEncryptedData(key: string): void {
  sessionStorage.removeItem(key);
}
