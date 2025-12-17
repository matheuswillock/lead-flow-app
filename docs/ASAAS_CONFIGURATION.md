# � Configuração Asaas - Lead Flow App

> Mensagem para enviar via WhatsApp ao parceiro

---

## 🔑 Instruções para Configuração do Asaas

Olá! Para integrarmos a plataforma com o sistema de pagamentos, preciso que você configure o **Asaas** seguindo estes passos:

### **1️⃣ Obter a API Key**

**Acesse:** https://www.asaas.com (ou https://sandbox.asaas.com para testes)

1. Faça login na sua conta Asaas
2. Vá em: **Configurações** → **Integrações** → **API Key**
3. **Copie** a chave completa (formato: `aact_prod_...` ou `aact_hmlg_...`)
4. Me envie essa chave

---

### **2️⃣ Configurar Webhook**

1. No painel Asaas, vá em: **Configurações** → **Integrações** → **Webhooks**
2. Clique em **"Novo Webhook"** ou **"Adicionar"**
3. Preencha:

**URL de Callback:**
```
https://www.corretorstudio.com.br/api/webhooks/asaas
```

**Token de Autenticação:**
```
82ad54d8b4bd818ed87c4306b4f9cbe69905859999edc25052bb277ed35f23fb
```

**Eventos:** Marque TODOS os eventos disponíveis, principalmente:
- ✅ PAYMENT_CONFIRMED
- ✅ PAYMENT_RECEIVED  
- ✅ PAYMENT_CREATED
- ✅ PAYMENT_OVERDUE
- ✅ (Todos os outros)

4. Clique em **"Salvar"**

---

### **3️⃣ Me Enviar**

Depois de configurar, me envie:

1. ✅ A **API Key** completa
2. ✅ Print/confirmação de que o webhook foi criado com sucesso

Pronto! Depois eu faço os testes aqui para validar que está tudo funcionando corretamente.

---

**Dúvidas?** Pode me chamar no WhatsApp que te ajudo! 👍
