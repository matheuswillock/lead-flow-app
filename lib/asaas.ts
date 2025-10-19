// lib/asaas.ts
const ASAAS_API_URL = process.env.ASAAS_ENV === "production"
  ? "https://www.asaas.com/api/v3"
  : "https://sandbox.asaas.com/api/v3";

// const ASAAS_API_KEY = "$aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmFmZjY1NWMwLTAzODUtNGIyZC1hZTVlLThlZTRmZWM1ZjEzNTo6JGFhY2hfZTU4NDhlY2ItZTMyZS00YjE4LWJlNTgtNDlkZGEwYWZkYmNk";

const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
console.info('🔍 [ASAAS] Carregando configuração:');
console.info('🔍 [ASAAS] ASAAS_ENV:', process.env.ASAAS_ENV);
console.info('🔍 [ASAAS] ASAAS_URL:', process.env.ASAAS_URL);
console.info('🔍 [ASAAS] ASAAS_API_KEY exists:', !!ASAAS_API_KEY);
console.info('🔍 [ASAAS] ASAAS_API_KEY length:', ASAAS_API_KEY?.length || 0);
// Avoid logging full keys in production logs
if (ASAAS_API_KEY) {
  const start = ASAAS_API_KEY.slice(0, 6);
  const end = ASAAS_API_KEY.slice(-6);
  console.info('🔍 [ASAAS] ASAAS_API_KEY preview:', `${start}...${end}`);
}

if (!ASAAS_API_KEY) {
  console.warn('⚠️ ASAAS_API_KEY não configurada - funcionalidades de pagamento estarão desabilitadas');
}

// Headers padrão para requisições ao Asaas
export const asaasHeaders = {
  'Content-Type': 'application/json',
  'access_token': `$${ASAAS_API_KEY}` || '',
};

console.info('🔑 [ASAAS] asaasHeaders.access_token length:', asaasHeaders.access_token);

// Endpoints da API Asaas
export const asaasApi = {
  customers: `${ASAAS_API_URL}/customers`,
  subscriptions: `${ASAAS_API_URL}/subscriptions`,
  payments: `${ASAAS_API_URL}/payments`,
  webhooks: `${ASAAS_API_URL}/notifications`,
  pixQrCode: (paymentId: string) => `${ASAAS_API_URL}/payments/${paymentId}/pixQrCode`,
};

// Helper para fazer requisições ao Asaas com tratamento de erros
export async function asaasFetch(endpoint: string, options?: RequestInit) {
  if (!ASAAS_API_KEY) {
    throw new Error('ASAAS_API_KEY não configurada');
  }

  // Log detalhado da requisição
  console.info('🔑 [ASAAS] Fazendo requisição:');
  console.info('🔑 [ASAAS] Endpoint:', endpoint);
  console.info('🔑 [ASAAS] access_token length:', asaasHeaders.access_token.length);
  // Do not print full secrets; show only length for diagnostics

  // Log do body se existir
  if (options?.body) {
    try {
      const bodyString = options.body as string;
      // Redact potential sensitive fields before logging
      try {
        const bodyObj = JSON.parse(bodyString);
        const safe = { ...bodyObj };
        if (safe.cpfCnpj) safe.cpfCnpj = `${String(safe.cpfCnpj).slice(0,3)}***`;
        if (safe.creditCard) safe.creditCard = { ...safe.creditCard, number: '****', ccv: '***' };
        console.info('🔑 [ASAAS] Body parsed (redacted):', safe);
      } catch {
        console.info('🔑 [ASAAS] Body (string)');
      }
    } catch {
  console.info('🔑 [ASAAS] Body (não-JSON)');
    }
  }

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        ...asaasHeaders,
        ...options?.headers,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ errors: [] }));
      const errorMessage = error.errors?.[0]?.description || `Erro na API Asaas: ${response.status}`;
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error: any) {
    console.error('❌ Erro na requisição Asaas:', error);
    throw error;
  }
}

// Função legada mantida para compatibilidade
const BASE = ASAAS_API_URL;

export async function asaas(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  // headers.set("Authorization", `Bearer ${ASAAS_API_KEY}`)
  headers.set("Content-Type", "application/json")
  const res = await fetch(`${BASE}${path}`, { ...init, headers, cache: "no-store" })
  if (!res.ok) throw new Error(`Asaas ${res.status}: ${await res.text()}`)
  return res.json()
}

/** Exemplo: criar cliente no Asaas */
export async function createAsaasCustomer(payload: {
  name: string; email?: string; cpfCnpj?: string; phone?: string;
}) {
  return asaas("/customers", { method: "POST", body: JSON.stringify(payload) })
}
