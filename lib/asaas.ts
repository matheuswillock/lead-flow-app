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

// Validação e logs executados apenas uma vez (usar getters para valores dinâmicos)
const logAsaasConfig = () => {
  const ASAAS_API_KEY = getAsaasApiKey();
  const ASAAS_ENVIRONMENT = getAsaasEnvironment();
  const IS_PRODUCTION = getIsProduction();
  const ASAAS_API_URL = getAsaasApiUrl();
  
  // Validação: API Key de produção não deve conter '_hmlg_'
  if (IS_PRODUCTION && ASAAS_API_KEY?.includes('_hmlg_')) {
    console.warn('⚠️ [ASAAS] ATENÇÃO: Usando chave de SANDBOX em ambiente de PRODUÇÃO!');
    console.warn('⚠️ [ASAAS] Configure uma chave de produção válida em ASAAS_API_KEY');
  }

  // Validação: API Key de sandbox deve conter '_hmlg_'
  if (!IS_PRODUCTION && ASAAS_API_KEY && !ASAAS_API_KEY.includes('_hmlg_')) {
    console.warn('⚠️ [ASAAS] ATENÇÃO: Usando chave de PRODUÇÃO em ambiente de DESENVOLVIMENTO!');
    console.warn('⚠️ [ASAAS] Para testes, use uma chave de sandbox (contém _hmlg_)');
  }

  // Validação: Verificar se URLs do .env estão corretas
  if (IS_PRODUCTION) {
    const envUrl = process.env.ASAAS_URL;
    if (envUrl && !envUrl.includes('www.asaas.com')) {
      console.warn('⚠️ [ASAAS] ATENÇÃO: ASAAS_URL não aponta para produção (www.asaas.com)!');
      console.warn('⚠️ [ASAAS] URL atual:', envUrl);
    }
  } else {
    const envUrl = process.env.ASAAS_URL_sandbox;
    if (envUrl && !envUrl.includes('sandbox.asaas.com')) {
      console.warn('⚠️ [ASAAS] ATENÇÃO: ASAAS_URL_sandbox não aponta para sandbox!');
      console.warn('⚠️ [ASAAS] URL atual:', envUrl);
    }
  }

  // Logs de configuração do ASAAS
  console.info('🔍 [ASAAS] Configuração carregada');
  console.info('🔍 [ASAAS] NODE_ENV:', process.env.NODE_ENV || 'development');
  console.info('🔍 [ASAAS] ASAAS_ENV:', process.env.ASAAS_ENV || 'auto');
  console.info('🔍 [ASAAS] Environment detectado:', ASAAS_ENVIRONMENT);
  console.info('🔍 [ASAAS] API URL:', ASAAS_API_URL);
  console.info('🔍 [ASAAS] URL Source:', IS_PRODUCTION 
    ? (process.env.ASAAS_URL ? 'ASAAS_URL (.env)' : 'hardcoded fallback')
    : (process.env.ASAAS_URL_sandbox ? 'ASAAS_URL_sandbox (.env)' : 'hardcoded fallback')
  );
  console.info('🔍 [ASAAS] ASAAS_API_KEY exists:', !!ASAAS_API_KEY);
  if (ASAAS_API_KEY) {
    const keyType = ASAAS_API_KEY.includes('_hmlg_') ? 'SANDBOX' : 'PRODUCTION';
    console.info('🔍 [ASAAS] API Key type:', keyType);
    console.info('🔍 [ASAAS] API Key preview:', `${ASAAS_API_KEY.slice(0, 10)}...${ASAAS_API_KEY.slice(-8)}`);
  }
};

// Executar logs apenas uma vez quando o módulo é importado
logAsaasConfig();

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
  get webhooks() { return `${getAsaasApiUrl()}/notifications`; },
  get checkouts() { return `${getAsaasApiUrl()}/checkouts`; },
  pixQrCode: (paymentId: string) => `${getAsaasApiUrl()}/payments/${paymentId}/pixQrCode`,
};

// Helper para fazer requisições ao Asaas com tratamento de erros
export async function asaasFetch(endpoint: string, options?: RequestInit) {
  const ASAAS_API_KEY = getAsaasApiKey();
  
  if (!ASAAS_API_KEY) {
    throw new Error('ASAAS_API_KEY não configurada');
  }

  // Log detalhado da requisição
  console.info('🔑 [ASAAS] Fazendo requisição:');
  console.info('🔑 [ASAAS] Endpoint:', endpoint);
  console.info('🔑 [ASAAS] API URL base:', getAsaasApiUrl());
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
const getBase = () => getAsaasApiUrl();

export async function asaas(path: string, init?: RequestInit) {
  const BASE = getBase();
  
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
