# 📧 Configuração de Domínio Personalizado no Resend

> Guia para configurar `corretorstudio.com.br` no Resend e enviar e-mails profissionais

## 🎯 Por que configurar?

Atualmente os e-mails estão sendo enviados com `onboarding@resend.dev` (domínio de teste).

Com domínio personalizado:
- ✅ E-mails mais profissionais: `no-reply@corretorstudio.com.br`
- ✅ Melhor entregabilidade (não cai em spam)
- ✅ Confiança dos usuários
- ✅ Branding consistente

## 📋 Passo a Passo

### 1️⃣ Adicionar Domínio no Resend

1. Acesse: https://resend.com/domains
2. Clique em **"Add Domain"**
3. Digite: `corretorstudio.com.br`
4. Clique em **"Add"**

### 2️⃣ Configurar Registros DNS

O Resend vai fornecer **3 registros DNS** que você precisa adicionar no seu provedor de domínio:

#### 📝 Registros fornecidos (exemplo):

```
Tipo: TXT
Nome: @
Valor: v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...

Tipo: TXT  
Nome: resend._domainkey
Valor: k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...

Tipo: MX
Nome: @
Valor: feedback-smtp.us-east-1.amazonses.com
Prioridade: 10
```

### 3️⃣ Adicionar Registros no Provedor de Domínio

#### Se usar **Registro.br**:
1. Acesse: https://registro.br
2. Login → Meus Domínios → `corretorstudio.com.br`
3. DNS → Adicionar Registro
4. Adicione os 3 registros fornecidos pelo Resend

#### Se usar **Cloudflare**:
1. Acesse: https://dash.cloudflare.com
2. Selecione `corretorstudio.com.br`
3. DNS → Add Record
4. Adicione os 3 registros fornecidos pelo Resend

#### Se usar **GoDaddy**:
1. Acesse: https://dcc.godaddy.com/domains
2. Selecione `corretorstudio.com.br`
3. DNS → Manage → Add
4. Adicione os 3 registros fornecidos pelo Resend

### 4️⃣ Verificar Domínio

1. Após adicionar os registros DNS, volte ao Resend
2. Clique em **"Verify Domain"**
3. Aguarde (pode levar até 72h, mas geralmente é instantâneo)
4. Quando verificado, aparecerá ✅ **Verified**

### 5️⃣ Atualizar Código

Após domínio verificado, editar `lib/services/EmailService.ts`:

```typescript
// ANTES (temporário):
from: options.from || "Corretor Studio <onboarding@resend.dev>",

// DEPOIS (produção):
from: options.from || "Corretor Studio <no-reply@corretorstudio.com.br>",
```

## 🧪 Testar E-mails

Após verificar o domínio, teste enviando um e-mail:

```bash
# Via API
curl -X POST http://localhost:3000/api/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "type": "welcome",
    "userName": "Teste",
    "userEmail": "seu@email.com",
    "loginUrl": "http://localhost:3000/sign-in"
  }'
```

Ou cadastre um novo usuário e verifique se o e-mail chega.

## ❓ Troubleshooting

### ⚠️ "Domain not verified" após 24h

**Solução:**
1. Verifique se os registros DNS foram adicionados corretamente
2. Use ferramentas de verificação DNS:
   - https://mxtoolbox.com/SuperTool.aspx
   - Digite: `corretorstudio.com.br`
   - Verifique se aparecem os registros TXT e MX

### ⚠️ E-mails caindo em spam

**Soluções:**
1. Configure SPF record:
   ```
   Tipo: TXT
   Nome: @
   Valor: v=spf1 include:amazonses.com ~all
   ```

2. Configure DMARC record:
   ```
   Tipo: TXT
   Nome: _dmarc
   Valor: v=DMARC1; p=none; rua=mailto:dmarc@corretorstudio.com.br
   ```

### ⚠️ E-mails não chegam

**Verificações:**
1. Checa logs do servidor: `console.error` no EmailService
2. Verifica quota do Resend: https://resend.com/overview
3. Testa com outro e-mail (Gmail, Outlook)

## 📊 Métricas do Resend

Após configurar, acompanhe:
- https://resend.com/emails
  - Taxa de entrega
  - E-mails enviados
  - Erros

## 🔗 Links Úteis

- **Dashboard Resend**: https://resend.com/overview
- **Domínios**: https://resend.com/domains
- **API Keys**: https://resend.com/api-keys
- **Documentação**: https://resend.com/docs
- **Verificador DNS**: https://mxtoolbox.com

## ⏱️ Tempo Estimado

- Adicionar registros DNS: **5 minutos**
- Propagação DNS: **15 minutos a 72 horas** (geralmente < 1h)
- Verificação no Resend: **Instantâneo** (após DNS propagar)

---

💡 **Dica**: Enquanto não configurar, os e-mails continuarão funcionando com `onboarding@resend.dev`, mas com branding do Resend.
