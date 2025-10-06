// lib/asaas.ts
const ASAAS_API_URL = process.env.ASAAS_ENV === "production"
  ? "https://www.asaas.com/api/v3"
  : "https://sandbox.asaas.com/api/v3";

const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

if (!ASAAS_API_KEY) {
  console.warn('⚠️ ASAAS_API_KEY não configurada - funcionalidades de pagamento estarão desabilitadas');
}

// Headers padrão para requisições ao Asaas
export const asaasHeaders = {
  'Content-Type': 'application/json',
  'access_token': ASAAS_API_KEY || '',
};

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
  headers.set("Authorization", `Bearer ${ASAAS_API_KEY}`)
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
