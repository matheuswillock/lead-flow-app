// lib/asaas.ts

// Detectar ambiente automaticamente
// Prioridade: ASAAS_ENV > NODE_ENV > 'sandbox'
const detectEnvironment = () => {
  // Se ASAAS_ENV está definido, use ele
  if (process.env.ASAAS_ENV) {
    return process.env.ASAAS_ENV === 'production' ? 'production' : 'sandbox';
  }
  
  // Se NODE_ENV é production, use produção do Asaas
  if (process.env.NODE_ENV === 'production') {
    return 'production';
  }
  
  // Default: sandbox para desenvolvimento
  return 'sandbox';
};

// Funções getter para garantir que valores sejam lidos no momento da execução
const getAsaasEnvironment = () => detectEnvironment();
const getIsProduction = () => getAsaasEnvironment() === 'production';

// URL da API Asaas (getter para garantir leitura dinâmica)
// Prioridade: ASAAS_URL/ASAAS_URL_sandbox do .env > URLs padrão
const getAsaasApiUrl = () => {
  const isProduction = getIsProduction();
  
  if (isProduction) {
    // Produção: usar ASAAS_URL do .env ou fallback para URL padrão
    const envUrl = process.env.ASAAS_URL;
    const baseUrl = envUrl || "https://www.asaas.com";
    return `${baseUrl}/api/v3`;
  } else {
    // Sandbox: usar ASAAS_URL_sandbox do .env ou fallback para URL padrão
    const envUrl = process.env.ASAAS_URL_sandbox;
    const baseUrl = envUrl || "https://sandbox.asaas.com";
    return `${baseUrl}/api/v3`;
  }
};

const getAsaasApiKey = () => process.env.ASAAS_API_KEY;

// Headers padrão para requisições ao Asaas (usar getter para API key dinâmica)
export const asaasHeaders = {
  'Content-Type': 'application/json',
  get 'access_token'() {
    const key = getAsaasApiKey();
    return `$${key}` || '';
  }
};

// Endpoints da API Asaas (usar getters para URLs dinâmicas)
export const asaasApi = {
  get customers() { return `${getAsaasApiUrl()}/customers`; },
  get subscriptions() { return `${getAsaasApiUrl()}/subscriptions`; },
  get payments() { return `${getAsaasApiUrl()}/payments`; },
  /** @deprecated use `notifications` — path legado apontava para /notifications */
  get webhooks() { return `${getAsaasApiUrl()}/notifications`; },
  get notifications() { return `${getAsaasApiUrl()}/notifications`; },
  customerNotifications: (customerId: string) =>
    `${getAsaasApiUrl()}/customers/${customerId}/notifications`,
  notificationById: (notificationId: string) =>
    `${getAsaasApiUrl()}/notifications/${notificationId}`,
  get notificationsBatch() { return `${getAsaasApiUrl()}/notifications/batch`; },
  get checkouts() { return `${getAsaasApiUrl()}/checkouts`; },
  pixQrCode: (paymentId: string) => `${getAsaasApiUrl()}/payments/${paymentId}/pixQrCode`,
};

export type AsaasCustomerNotification = {
  id: string
  customer: string
  enabled: boolean
  emailEnabledForProvider?: boolean
  smsEnabledForProvider?: boolean
  emailEnabledForCustomer?: boolean
  smsEnabledForCustomer?: boolean
  phoneCallEnabledForCustomer?: boolean
  whatsappEnabledForCustomer?: boolean
  event?: string
  scheduleOffset?: number
  deleted?: boolean
}

export type AsaasCustomerNotificationUpdate = {
  id: string
  enabled?: boolean
  emailEnabledForProvider?: boolean
  smsEnabledForProvider?: boolean
  emailEnabledForCustomer?: boolean
  smsEnabledForCustomer?: boolean
  phoneCallEnabledForCustomer?: boolean
  whatsappEnabledForCustomer?: boolean
  scheduleOffset?: number
}

export function buildDisableCustomerFacingNotificationPatch(
  notification: Pick<AsaasCustomerNotification, "id">
): AsaasCustomerNotificationUpdate {
  return {
    id: notification.id,
    emailEnabledForCustomer: false,
    smsEnabledForCustomer: false,
    phoneCallEnabledForCustomer: false,
    whatsappEnabledForCustomer: false,
  }
}

// Helper para fazer requisições ao Asaas com tratamento de erros
export async function asaasFetch(endpoint: string, options?: RequestInit) {
  const ASAAS_API_KEY = getAsaasApiKey();
  
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
      const err = new Error(errorMessage);
      (err as any).statusCode = response.status;
      throw err;
    }

    return response.json();
  } catch (error: any) {
    console.error('❌ Erro na requisição Asaas:', error);
    throw error;
  }
}

// Função legada mantida para compatibilidade
const getBase = () => getAsaasApiUrl();

export async function asaas(path: string, init?: RequestInit) {
  const BASE = getBase();
  const ASAAS_API_KEY = getAsaasApiKey();

  if (!ASAAS_API_KEY) {
    throw new Error('ASAAS_API_KEY não configurada');
  }

  const headers = new Headers(init?.headers)
  headers.set("Content-Type", "application/json")
  headers.set("access_token", `$${ASAAS_API_KEY}`)
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
