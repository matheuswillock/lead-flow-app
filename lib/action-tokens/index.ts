/**
 * Action Tokens — tokens de curta duração para requisições client-side obrigatórias
 *
 * Para mutações que não podem virar Server Actions (ex.: WhatsApp, Board Kanban),
 * o servidor emite um token HMAC + timestamp embutido na página via Server Component.
 * Cada token:
 *   - É válido por ACTION_TOKEN_TTL_MINUTES (padrão: 15 min)
 *   - É vinculado ao profileId da sessão
 *   - Inclui um nonce único para prevenir replay
 *
 * USO (servidor — Server Component ou Route Handler):
 *   const token = await createActionToken(profileId)
 *
 * USO (servidor — Route Handler para validação):
 *   const result = await validateActionToken(tokenValue, profileId)
 *
 * NOTA: A invalidação após uso (one-time token) requer Redis/KV.
 * Por ora, a expiração por TTL já previne replays de longa duração.
 */

const TTL_MINUTES = Number(process.env.ACTION_TOKEN_TTL_MINUTES ?? 15);
const SECRET = process.env.ACTION_TOKEN_SECRET ?? 'dev-action-token-secret-change-in-prod';

interface ActionTokenPayload {
  profileId: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
}

async function hmac(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Emite um action token assinado para o profileId fornecido.
 * Deve ser chamado apenas em Server Components ou Route Handlers.
 */
export async function createActionToken(profileId: string): Promise<string> {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + TTL_MINUTES * 60 * 1000;
  const nonce = crypto.randomUUID();
  const payload: ActionTokenPayload = { profileId, nonce, issuedAt, expiresAt };
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = btoa(payloadJson);
  const signature = await hmac(`${payloadB64}`, SECRET);
  return `${payloadB64}.${signature}`;
}

export interface ActionTokenValidationResult {
  valid: boolean;
  profileId?: string;
  reason?: string;
}

/**
 * Valida um action token recebido em uma requisição client-side.
 * Deve ser chamado nos Route Handlers que aceitam mutações client-side.
 */
export async function validateActionToken(
  token: string,
  expectedProfileId: string,
): Promise<ActionTokenValidationResult> {
  try {
    const [payloadB64, receivedSig] = token.split('.');
    if (!payloadB64 || !receivedSig) {
      return { valid: false, reason: 'malformed' };
    }

    const expectedSig = await hmac(payloadB64, SECRET);
    if (receivedSig !== expectedSig) {
      return { valid: false, reason: 'invalid_signature' };
    }

    const payload = JSON.parse(atob(payloadB64)) as ActionTokenPayload;

    if (Date.now() > payload.expiresAt) {
      return { valid: false, reason: 'expired' };
    }

    if (payload.profileId !== expectedProfileId) {
      return { valid: false, reason: 'profile_mismatch' };
    }

    return { valid: true, profileId: payload.profileId };
  } catch {
    return { valid: false, reason: 'parse_error' };
  }
}
