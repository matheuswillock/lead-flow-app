# 📧 **Como usar o Resend no Lead Flow App**

## 🚀 **Configuração Inicial**

### 1. **Variável de Ambiente**
Adicione sua chave da API do Resend no arquivo `.env.local`:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. **Obter API Key**
1. Acesse [resend.com/api-keys](https://resend.com/api-keys)
2. Clique em "Create API Key"
3. Nome: "Lead Flow Production" (ou dev/test)
4. Permissão: "Sending access" (suficiente)
5. Copie a chave gerada

---

## 🛠️ **Como Usar**

### **1. Serviço de Email (Recomendado)**

```typescript
import { emailService } from "@/lib/services/EmailService";

// Email de boas-vindas
await emailService.sendWelcomeEmail({
  userName: "João Silva",
  userEmail: "joao@exemplo.com",
  loginUrl: "https://seuapp.com/login"
});

// Notificação de novo lead
await emailService.sendLeadNotification({
  leadName: "Maria Santos", 
  leadEmail: "maria@exemplo.com",
  leadPhone: "(11) 99999-9999",
  managerName: "João Silva",
  managerEmail: "joao@exemplo.com"
});

// Email personalizado
await emailService.sendEmail({
  to: ["destinatario@exemplo.com"],
  subject: "Assunto",
  html: "<h1>Olá!</h1>",
  from: "Seu App <noreply@seuapp.com>"
});
```

### **2. API REST**

**POST** `/api/email/send`

```json
{
  "type": "welcome",
  "userName": "João Silva",
  "userEmail": "joao@exemplo.com", 
  "loginUrl": "https://seuapp.com/login"
}
```

**Tipos disponíveis:**
- `welcome` - Email de boas-vindas
- `lead-notification` - Notificação de novo lead
- `password-reset` - Redefinição de senha
- `custom` - Email personalizado

### **3. Integração Automática**

O sistema já está configurado para:
✅ **Enviar email de boas-vindas** automaticamente quando um novo usuário é criado
✅ **Não falhar a criação** se o email não conseguir ser enviado
✅ **Logs de erro** para debugging

---

## 📋 **Exemplos de Uso**

### **Email de Boas-vindas**
```bash
curl -X POST http://localhost:3000/api/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "type": "welcome",
    "userName": "João Silva", 
    "userEmail": "joao@exemplo.com",
    "loginUrl": "http://localhost:3000/sign-in"
  }'
```

### **Notificação de Lead**
```bash
curl -X POST http://localhost:3000/api/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "type": "lead-notification",
    "leadName": "Maria Santos",
    "leadEmail": "maria@exemplo.com", 
    "managerName": "João Silva",
    "managerEmail": "joao@exemplo.com"
  }'
```

### **Email Personalizado**
```bash
curl -X POST http://localhost:3000/api/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "type": "custom",
    "to": ["destinatario@exemplo.com"],
    "subject": "Teste do Lead Flow",
    "html": "<h1>Olá!</h1><p>Este é um teste.</p>"
  }'
```

---

## 🎯 **MCP Server: Resend**

O **MCP Server: Resend** que você tem instalado permite:

1. **Pesquisar documentação** sobre Resend
2. **Obter exemplos de código** específicos
3. **Troubleshooting** de problemas de integração
4. **Best practices** para email transacional

### **Como usar o MCP:**
```typescript
// O MCP já está disponível via função mcp_resend_SearchResend
// Usado para buscar informações específicas do Resend
```

---

## ⚠️ **Importante**

### **Domínio Verificado**
- Para produção, configure um domínio verificado no Resend
- Emails de `@resend.dev` são apenas para teste
- Configure SPF/DKIM para melhor deliverability

### **Rate Limits**
- Resend tem limites por minuto/hora
- Implemente retry logic se necessário
- Monitore uso no dashboard do Resend

### **Segurança**
- ✅ API Key está em variável de ambiente
- ✅ Não exposta no frontend
- ✅ Logs de erro sem exposição de dados sensíveis

---

## 🧪 **Testando**

1. **Verificar exemplos:**
```bash
curl http://localhost:3000/api/email/send
```

2. **Testar email:**
```bash
curl -X POST http://localhost:3000/api/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "type": "custom",
    "to": ["seu-email@exemplo.com"],
    "subject": "Teste Lead Flow", 
    "text": "Email funcionando!"
  }'
```

3. **Criar usuário e verificar email automático:**
- Crie um novo usuário via interface
- Verifique se o email de boas-vindas foi enviado
- Confira logs no console para debugging

---

## 📚 **Recursos Adicionais**

- [Documentação Resend](https://resend.com/docs)
- [Dashboard Resend](https://resend.com/dashboard)
- [Status Page](https://status.resend.com)
- [Rate Limits](https://resend.com/docs/api-reference/introduction#rate-limits)