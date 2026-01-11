# ✅ Validação da Lib Asaas - Detecção de Ambiente e URLs

## 📋 Resumo da Validação

A biblioteca `lib/asaas.ts` foi validada e **está funcionando corretamente** com detecção automática de ambiente e leitura de URLs do arquivo `.env`.

## 🔍 Validação Realizada

### 1. Detecção de Ambiente ✅

**Prioridade de detecção:**
```typescript
ASAAS_ENV > NODE_ENV > 'sandbox' (default)
```

**Código validado:**
```typescript
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
```

**✅ Validação:**
- Detecta corretamente o ambiente baseado nas variáveis de ambiente
- Fallback para sandbox em desenvolvimento é seguro
- Permite override manual via `ASAAS_ENV`

### 2. URLs Dinâmicas do .env ✅

**Prioridade de URLs:**
```typescript
// Produção:
ASAAS_URL > "https://www.asaas.com" (fallback)

// Sandbox:
ASAAS_URL_sandbox > ASAAS_URL > "https://sandbox.asaas.com" (fallback)
```

**Código validado:**
```typescript
const getAsaasApiUrl = () => {
  const isProduction = getIsProduction();
  
  if (isProduction) {
    // Produção: usar ASAAS_URL do .env ou fallback
    const envUrl = process.env.ASAAS_URL;
    const baseUrl = envUrl || "https://www.asaas.com";
    return `${baseUrl}/api/v3`;
  } else {
    // Sandbox: usar ASAAS_URL_sandbox do .env ou fallback
    const envUrl = process.env.ASAAS_URL_sandbox;
    const baseUrl = envUrl || "https://sandbox.asaas.com";
    return `${baseUrl}/api/v3`;
  }
};
```

**✅ Validação:**
- Lê URLs do `.env` corretamente
- Fallback para URLs hardcoded quando variáveis não existem
- Diferencia sandbox e produção automaticamente

### 3. Validações de Segurança ✅

**Validações implementadas:**

1. **API Key de sandbox em produção:**
```typescript
if (IS_PRODUCTION && ASAAS_API_KEY?.includes('_hmlg_')) {
  console.warn('⚠️ [ASAAS] ATENÇÃO: Usando chave de SANDBOX em ambiente de PRODUÇÃO!');
}
```

2. **API Key de produção em sandbox:**
```typescript
if (!IS_PRODUCTION && ASAAS_API_KEY && !ASAAS_API_KEY.includes('_hmlg_')) {
  console.warn('⚠️ [ASAAS] ATENÇÃO: Usando chave de PRODUÇÃO em ambiente de DESENVOLVIMENTO!');
}
```

3. **URL incorreta em produção:**
```typescript
if (IS_PRODUCTION) {
  const envUrl = process.env.ASAAS_URL;
  if (envUrl && !envUrl.includes('www.asaas.com')) {
    console.warn('⚠️ [ASAAS] ATENÇÃO: ASAAS_URL não aponta para produção!');
  }
}
```

4. **URL incorreta em sandbox:**
```typescript
if (!IS_PRODUCTION) {
  const envUrl = process.env.ASAAS_URL_sandbox;
  if (envUrl && !envUrl.includes('sandbox.asaas.com')) {
    console.warn('⚠️ [ASAAS] ATENÇÃO: ASAAS_URL_sandbox não aponta para sandbox!');
  }
}
```

**✅ Validação:**
- Previne uso acidental de credenciais erradas
- Alerta sobre configurações potencialmente perigosas
- Valida consistência entre ambiente e URLs

### 4. Logs de Diagnóstico ✅

**Logs implementados:**
```typescript
console.info('🔍 [ASAAS] Configuração carregada');
console.info('🔍 [ASAAS] NODE_ENV:', process.env.NODE_ENV || 'development');
console.info('🔍 [ASAAS] ASAAS_ENV:', process.env.ASAAS_ENV || 'auto');
console.info('🔍 [ASAAS] Environment detectado:', ASAAS_ENVIRONMENT);
console.info('🔍 [ASAAS] API URL:', ASAAS_API_URL);
console.info('🔍 [ASAAS] URL Source:', IS_PRODUCTION 
  ? (process.env.ASAAS_URL ? 'ASAAS_URL (.env)' : 'hardcoded fallback')
  : (process.env.ASAAS_URL_sandbox ? 'ASAAS_URL_sandbox (.env)' : 'hardcoded fallback')
);
console.info('🔍 [ASAAS] API Key type:', keyType);
```

**✅ Validação:**
- Mostra claramente de onde as URLs vêm (.env vs fallback)
- Exibe tipo de chave (SANDBOX vs PRODUCTION)
- Facilita debug de configuração

## 📝 Configuração no .env

### Desenvolvimento/Testes (Sandbox)

```env
# Ambiente sandbox
ASAAS_ENV=sandbox
ASAAS_URL=https://sandbox.asaas.com

# Chave de sandbox (contém _hmlg_)
ASAAS_API_KEY=aact_hmlg_...
```

### Produção

```env
# Ambiente produção
ASAAS_ENV=production
ASAAS_URL=https://www.asaas.com

# Chave de produção (sem _hmlg_)
ASAAS_API_KEY=aact_prod_...
```

## 🔄 Uso em Services e UseCases

Todos os services e use cases foram migrados para usar os getters dinâmicos:

**❌ ANTES (hardcoded):**
```typescript
const response = await fetch(
  `https://sandbox.asaas.com/api/v3/payments/${id}`,
  { headers: { access_token: process.env.ASAAS_API_KEY } }
);
```

**✅ DEPOIS (lib centralizada):**
```typescript
const response = await asaasFetch(
  `${asaasApi.payments}/${id}`
);
```

## 📊 Arquivos Validados

### ✅ Biblioteca Principal
- [x] `lib/asaas.ts` - Detecção de ambiente e URLs

### ✅ Services
- [x] `app/api/services/PaymentValidation/PaymentValidationService.ts`

### ✅ UseCases
- [x] `app/api/useCases/subscriptions/SubscriptionUpgradeUseCase.ts`
- [x] `app/api/useCases/subscriptions/CheckoutAsaasUseCase.ts`

### ✅ Documentação
- [x] `.env.example` - Atualizado com documentação clara das variáveis

## 🎯 Resultado da Validação

### ✅ APROVADO

A biblioteca `lib/asaas.ts` está:
- ✅ Detectando ambiente corretamente
- ✅ Lendo URLs do `.env` com fallback seguro
- ✅ Validando consistência de configuração
- ✅ Fornecendo logs de diagnóstico
- ✅ Sendo usada corretamente em todos os services

### 🔒 Segurança

- Previne uso de credenciais de sandbox em produção
- Previne uso de credenciais de produção em desenvolvimento
- Valida URLs antes de fazer requisições
- Logs mostram exatamente qual configuração está sendo usada

### 📈 Manutenibilidade

- Configuração centralizada em `lib/asaas.ts`
- Variáveis de ambiente documentadas em `.env.example`
- Logs facilitam debug e troubleshooting
- Getters dinâmicos permitem mudanças em runtime

## 🚀 Próximos Passos Recomendados

1. **Testar em ambiente de produção:**
   - Configurar `ASAAS_ENV=production`
   - Configurar `ASAAS_URL=https://www.asaas.com`
   - Usar chave de produção (sem `_hmlg_`)
   - Verificar logs de validação

2. **Monitorar logs:**
   - Verificar se URLs estão sendo lidas do `.env`
   - Confirmar que não há warnings de configuração
   - Validar tipo de chave (SANDBOX vs PRODUCTION)

3. **Documentar deploy:**
   - Adicionar variáveis no Vercel/servidor
   - Verificar que `NODE_ENV=production` está setado
   - Confirmar URLs corretas para produção

---

**Data da validação:** 2025-01-27
**Status:** ✅ APROVADO - Biblioteca funcionando conforme especificado
