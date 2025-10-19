# 🌐 Configuração de Webhooks com Ngrok - Lead Flow

> Guia para resolver problemas de 502 Bad Gateway com webhooks Asaas via Ngrok

## 🔍 Problema Identificado

**Sintoma**: Asaas retorna `502 Bad Gateway` ao enviar webhooks

**Causa**: Ngrok free tem uma página de aviso ("Browser Warning") que bloqueia requisições POST diretas de APIs externas.

**Evidência**: Response do webhook contém HTML do ngrok:
```html
<!DOCTYPE html>
<html class="h-full" lang="en-US" dir="ltr">
  <head>
    <link rel="preload" href="https://cdn.ngrok.com/static/fonts/...
```

## ✅ Soluções

### Opção 1: Usar Ngrok com Skip Browser Warning (RECOMENDADO)

O Asaas precisa adicionar o header `ngrok-skip-browser-warning` nas requisições.

**Problema**: Asaas **NÃO PERMITE** configurar headers customizados no webhook.

**Status**: ❌ Não funciona com ngrok free + Asaas

### Opção 2: Aceitar Warning Manualmente (TEMPORÁRIO)

1. **Abrir URL no navegador primeiro**:
   ```
   https://nonzero-rodrick-mentholated.ngrok-free.dev/api/webhooks/asaas
   ```

2. **Aceitar o aviso do ngrok** ("Visit Site")

3. **Testar webhook**:
   ```bash
   curl -X POST https://nonzero-rodrick-mentholated.ngrok-free.dev/api/webhooks/test \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```

**Status**: ⚠️ Temporário - warning expira periodicamente

### Opção 3: Ngrok Pago (MELHOR SOLUÇÃO)

Upgrade para ngrok paid plan remove o browser warning:

**Planos**:
- **Personal**: $8/mês - Remove warning
- **Pro**: $20/mês - Features avançadas

**Link**: https://ngrok.com/pricing

**Status**: ✅ Funciona 100%

### Opção 4: Usar Serviço Alternativo (GRATUITO)

Alternativas ao ngrok sem browser warning:

1. **LocalTunnel** (gratuito):
   ```bash
   npm install -g localtunnel
   lt --port 3000
   ```

2. **Serveo** (gratuito):
   ```bash
   ssh -R 80:localhost:3000 serveo.net
   ```

3. **Cloudflare Tunnel** (gratuito):
   ```bash
   npm install -g cloudflared
   cloudflared tunnel --url http://localhost:3000
   ```

**Status**: ✅ Funciona para testes

### Opção 5: Deploy em Servidor Real (PRODUÇÃO)

Deploy no Vercel/Netlify/Railway com domínio público:

**Vercel**:
```bash
npm install -g vercel
vercel
```

**URL webhook será**: `https://seu-app.vercel.app/api/webhooks/asaas`

**Status**: ✅ Melhor para produção

## 🧪 Como Testar

### 1. Testar Endpoint Básico

```bash
# GET simples
curl https://nonzero-rodrick-mentholated.ngrok-free.dev/api/webhooks/test

# POST com dados
curl -X POST https://nonzero-rodrick-mentholated.ngrok-free.dev/api/webhooks/test \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

**Logs esperados** (no terminal Next.js):
```
✅ [Webhook Test] POST recebido!
📦 [Webhook Test] Body: { test: 'data' }
```

### 2. Simular Webhook Asaas

```bash
curl -X POST https://nonzero-rodrick-mentholated.ngrok-free.dev/api/webhooks/asaas \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: 2c8531b5221a6baf951cf3f3c5c3cb25069ee85fc18db7b5f9d7526a26bb4d56" \
  -d '{
    "event": "PAYMENT_RECEIVED",
    "payment": {
      "id": "pay_test",
      "subscription": "sub_test",
      "status": "RECEIVED",
      "customer": "cus_test"
    }
  }'
```

**Logs esperados**:
```
🎯 [Webhook Asaas] Requisição recebida
📨 [Webhook Asaas] Evento recebido: PAYMENT_RECEIVED
✅ [PaymentValidationService] Pagamento CONFIRMADO!
```

### 3. Verificar Ngrok Dashboard

Acessar: http://127.0.0.1:4040

**Ver**:
- Requisições recebidas
- Status codes
- Request/Response completos
- Tempo de resposta

## 🔧 Configuração Atual

### .env
```env
NEXT_PUBLIC_APP_URL=https://nonzero-rodrick-mentholated.ngrok-free.dev
ASAAS_WEBHOOK_TOKEN=2c8531b5221a6baf951cf3f3c5c3cb25069ee85fc18db7b5f9d7526a26bb4d56
```

### Asaas Webhook
- **URL**: `https://nonzero-rodrick-mentholated.ngrok-free.dev/api/webhooks/asaas`
- **Token**: Configurado no campo "Token de autenticação"
- **Eventos**: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`

## 📋 Checklist de Troubleshooting

### Se webhook retornar 502:

- [ ] **Ngrok está rodando?**
  ```bash
  # Verificar se ngrok está ativo
  curl http://127.0.0.1:4040/api/tunnels
  ```

- [ ] **URL está correta?**
  - Copiar URL exata do terminal ngrok
  - Atualizar no painel Asaas
  - Verificar não tem `/` extra no final

- [ ] **Next.js está rodando?**
  ```bash
  curl http://localhost:3000/api/webhooks/test
  ```

- [ ] **Middleware não está bloqueando?**
  - Verificar logs: `[middleware] Webhook route - skipping auth`
  - Se não aparecer, middleware tem problema

- [ ] **Testar endpoint diretamente**:
  ```bash
  # Bypassing ngrok
  curl -X POST http://localhost:3000/api/webhooks/test \
    -H "Content-Type: application/json" \
    -d '{"test": true}'
  ```

- [ ] **Verificar logs do Asaas**:
  - Ir em: Integrações → Logs de Webhooks
  - Ver request/response completos
  - Verificar se tem HTML do ngrok

### Se webhook retornar 400/401:

- [ ] **Token está correto?**
  - Verificar `.env`: `ASAAS_WEBHOOK_TOKEN`
  - Verificar painel Asaas: mesmo token
  - Logs devem mostrar: "Token recebido: presente"

- [ ] **Corpo da requisição válido?**
  - Deve ter `event` e `payment`
  - Payment deve ter `id`
  - Ver logs: `📋 [Webhook Asaas] Detalhes completos do evento`

### Se Next.js não vê webhook:

- [ ] **Logs do Next.js vazios?**
  - Problema é no ngrok, não no Next.js
  - Testar localhost diretamente
  - Verificar ngrok dashboard

- [ ] **Ngrok retorna HTML?**
  - Browser warning está ativo
  - Precisa: upgrade ngrok OU usar alternativa
  - Não há solução com ngrok free + Asaas

## 🚀 Recomendação Final

**Para DESENVOLVIMENTO local**:
1. Usar **LocalTunnel** ou **Cloudflare Tunnel** (gratuitos, sem warning)
2. OU fazer upgrade ngrok para Personal ($8/mês)

**Para PRODUÇÃO**:
1. Deploy no **Vercel** (gratuito)
2. Configurar webhook com URL pública: `https://seu-app.vercel.app/api/webhooks/asaas`
3. Adicionar domínio customizado (opcional)

## 📝 Scripts Úteis

### Testar webhook completo
```bash
#!/bin/bash
# test-webhook.sh

NGROK_URL="https://nonzero-rodrick-mentholated.ngrok-free.dev"
TOKEN="2c8531b5221a6baf951cf3f3c5c3cb25069ee85fc18db7b5f9d7526a26bb4d56"

echo "🧪 Testando webhook..."

curl -X POST "$NGROK_URL/api/webhooks/asaas" \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: $TOKEN" \
  -d '{
    "event": "PAYMENT_RECEIVED",
    "payment": {
      "id": "pay_test_'"$(date +%s)"'",
      "subscription": "sub_test",
      "status": "RECEIVED",
      "customer": "cus_test",
      "value": 59.90
    }
  }' | jq '.'

echo ""
echo "✅ Verifique os logs do Next.js"
```

### Verificar ngrok status
```bash
#!/bin/bash
# check-ngrok.sh

echo "📡 Verificando ngrok..."
curl -s http://127.0.0.1:4040/api/tunnels | jq '.tunnels[] | {name, public_url, proto}'
```

---

✅ **Próximo passo**: Escolher entre upgrade ngrok, usar alternativa gratuita, ou fazer deploy

📚 **Referências**:
- [Ngrok Browser Warning](https://ngrok.com/docs/guides/browser-warning/)
- [LocalTunnel](https://github.com/localtunnel/localtunnel)
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Asaas Webhooks](https://docs.asaas.com/reference/webhooks)
