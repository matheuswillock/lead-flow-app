// lib/crypto.ts - Utilitário para criptografia de dados no sessionStorage

/**
 * Criptografa dados usando Base64 + XOR simples
 * Nota: Para produção, considere usar crypto-js ou similar
 */
export function encryptData(data: any): string {
  const jsonString = JSON.stringify(data);
  const key = process.env.ENCRYPTION_KEY || 'lead-flow-default-key-2025';
  
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
    const key = process.env.ENCRYPTION_KEY || 'lead-flow-default-key-2025';
    
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
  console.info(`🔐 [Crypto] Salvando dados criptografados com chave: ${key}`);
  console.info(`📦 [Crypto] Dados a serem salvos:`, {
    keys: Object.keys(data),
    hasSubscriptionId: !!data.subscriptionId,
    hasCustomerId: !!data.customerId,
    subscriptionId: data.subscriptionId,
    customerId: data.customerId
  });
  
  const encrypted = encryptData(data);
  sessionStorage.setItem(key, encrypted);
  
  console.info(`✅ [Crypto] Dados salvos com sucesso. Tamanho: ${encrypted.length} chars`);
}

/**
 * Recupera dados criptografados do sessionStorage
 */
export function getEncryptedData<T>(key: string): T | null {
  console.info(`🔓 [Crypto] Recuperando dados criptografados com chave: ${key}`);
  
  const encrypted = sessionStorage.getItem(key);
  
  if (!encrypted) {
    console.warn(`⚠️ [Crypto] Nenhum dado encontrado para chave: ${key}`);
    console.info(`📋 [Crypto] Chaves disponíveis no sessionStorage:`, Object.keys(sessionStorage));
    return null;
  }
  
  console.info(`✅ [Crypto] Dados encontrados. Tamanho: ${encrypted.length} chars`);
  
  const decrypted = decryptData<T>(encrypted);
  
  if (decrypted) {
    console.info(`✅ [Crypto] Dados descriptografados com sucesso:`, {
      keys: Object.keys(decrypted as any),
      hasSubscriptionId: !!(decrypted as any).subscriptionId,
      subscriptionId: (decrypted as any).subscriptionId
    });
  } else {
    console.error(`❌ [Crypto] Falha ao descriptografar dados`);
  }
  
  return decrypted;
}

/**
 * Remove dados do sessionStorage
 */
export function removeEncryptedData(key: string): void {
  sessionStorage.removeItem(key);
}
