# ✅ Checklist - Configuração Asaas PRODUÇÃO

> **Importante**: Este checklist deve ser seguido ANTES de fazer deploy em produção

## 📋 Índice
- [Pré-requisitos](#pré-requisitos)
- [1. Conta Asaas Produção](#1-conta-asaas-produção)
- [2. Configuração de Domínio](#2-configuração-de-domínio)
- [3. Webhooks](#3-webhooks)
- [4. Variáveis de Ambiente](#4-variáveis-de-ambiente)
- [5. Testes em Produção](#5-testes-em-produção)
- [6. Monitoramento](#6-monitoramento)
- [7. Validações Finais](#7-validações-finais)

---

## Pré-requisitos

### ✅ Antes de Começar

- [ ] Conta Asaas de **PRODUÇÃO** criada e verificada
- [ ] Acesso ao dashboard: https://www.asaas.com
- [ ] Domínio de produção configurado e ativo
- [ ] Deploy de produção pronto para receber variáveis de ambiente
- [ ] Acesso ao painel da plataforma de deploy (Vercel/Netlify/etc)

---

## 1. Conta Asaas Produção

### ✅ Configuração da Conta

- [ ] **Criar conta produção**: https://www.asaas.com
- [ ] **Verificar identidade**: Enviar documentos necessários
- [ ] **Aguardar aprovação**: Conta deve estar ativa e verificada
- [ ] **Configurar dados bancários**: Para receber transferências
- [ ] **Ativar API de produção**: No menu de configurações

### ✅ Obter Credenciais de Produção

- [ ] **Acessar**: https://www.asaas.com → Integrações → API
- [ ] **Copiar API Key** de produção: `$aact_YmFl...` (começa com `$aact_`)
- [ ] **Copiar Wallet ID**: Menu → Minha Conta → Informações
- [ ] **Salvar credenciais** em local seguro (gerenciador de senhas)

⚠️ **ATENÇÃO**: 
- API Key de produção é diferente da sandbox
- NUNCA commitar API Key no código
- API Key de produção começa com `$aact_` (não `$aact_hmlg_`)

---

## 2. Configuração de Domínio

### ✅ Cadastrar Domínio no Asaas

- [ ] **Acessar**: https://www.asaas.com → Minha Conta → Informações
- [ ] **Localizar**: Seção "Site/Domínio da sua aplicação"
- [ ] **Cadastrar domínio de produção**: 
  ```
  https://seu-dominio-producao.com.br
  ```
  Exemplo: `https://corretorlifeflow.com.br`
- [ ] **Salvar** configuração

⚠️ **IMPORTANTE**: 
- Deve ser o domínio EXATO onde a aplicação está hospedada
- Sem barra no final
- Com `https://`
- Mesma URL do `NEXT_PUBLIC_APP_URL` em produção

---

## 3. Webhooks

### ✅ Configurar Webhook de Produção

- [ ] **Acessar**: https://www.asaas.com → Integrações → Webhooks
- [ ] **Criar novo webhook**:

#### Configurações do Webhook:

**URL do Webhook**:
```
https://seu-dominio-producao.com.br/api/webhooks/asaas
```
- [ ] URL completa com `/api/webhooks/asaas`
- [ ] HTTPS obrigatório

**Status**:
- [ ] Marcar como **"Ativo"** ou **"Sim"**

**Versão da API**:
- [ ] Selecionar **"v3"**

**Eventos para Notificar**:
- [ ] ✅ `PAYMENT_RECEIVED` (Pagamento confirmado)
- [ ] ✅ `PAYMENT_CONFIRMED` (Pagamento confirmado)
- [ ] ✅ `PAYMENT_OVERDUE` (Pagamento vencido)
- [ ] ✅ `PAYMENT_DELETED` (Pagamento deletado)
- [ ] ✅ `PAYMENT_UPDATED` (Pagamento atualizado)

**Autenticação** (Opcional mas recomendado):
- [ ] Gerar Access Token
- [ ] Salvar token gerado
- [ ] Validar token no código do webhook (se implementado)

**Salvar Webhook**:
- [ ] Clicar em **"Salvar"**
- [ ] Confirmar que webhook está **ATIVO**

### ✅ Testar Webhook

- [ ] **Enviar evento de teste** pelo dashboard Asaas
- [ ] **Verificar logs** da aplicação
- [ ] **Confirmar** que webhook está recebendo eventos

---

## 4. Variáveis de Ambiente

### ✅ Configurar no Deploy (Vercel/Netlify/etc)

**Variáveis Asaas**:

```bash
# Asaas - PRODUÇÃO
ASAAS_URL=https://api.asaas.com/api/v3
ASAAS_API_KEY="$aact_[SUA_API_KEY_PRODUCAO]"
ASAAS_WALLET_ID=[SEU_WALLET_ID_PRODUCAO]
```

- [ ] **ASAAS_URL**: `https://api.asaas.com/api/v3` (sem `/sandbox`)
- [ ] **ASAAS_API_KEY**: API Key de PRODUÇÃO (com aspas por causa do `$`)
- [ ] **ASAAS_WALLET_ID**: Wallet ID de produção

**Outras Variáveis Importantes**:

```bash
# URL da Aplicação
NEXT_PUBLIC_APP_URL=https://seu-dominio-producao.com.br

# Webhook (mesma URL do passo 3)
ASAAS_WEBHOOK_URL=https://seu-dominio-producao.com.br/api/webhooks/asaas
```

- [ ] **NEXT_PUBLIC_APP_URL**: Domínio de produção (mesma URL do callback)
- [ ] **ASAAS_WEBHOOK_URL**: URL completa do webhook

### ✅ Validar Variáveis

- [ ] Todas as variáveis estão configuradas
- [ ] `ASAAS_API_KEY` está **entre aspas duplas** ("$aact_...")
- [ ] `ASAAS_URL` **NÃO** contém `/sandbox`
- [ ] `NEXT_PUBLIC_APP_URL` é o domínio correto

---

## 5. Testes em Produção

### ✅ Fluxo de Registro

- [ ] **Criar novo usuário** no ambiente de produção
- [ ] **Verificar**: Profile criado
- [ ] **Verificar**: Usuário Auth criado
- [ ] **Verificar**: Cliente Asaas criado

### ✅ Fluxo de Checkout

- [ ] **Criar checkout** para assinatura
- [ ] **Verificar**: Link de pagamento gerado
- [ ] **Verificar**: URL de callback correta
- [ ] **Acessar**: Link de pagamento

### ✅ Fluxo de Pagamento (Teste Real ou Sandbox de Produção)

**Opção 1: Teste com Valor Real Mínimo**
- [ ] Fazer pagamento real de R$ 1,00
- [ ] Confirmar recebimento
- [ ] Validar ativação da conta

**Opção 2: Sandbox de Produção (se disponível)**
- [ ] Usar dados de teste do Asaas
- [ ] Simular pagamento
- [ ] Validar webhook

### ✅ Webhook em Produção

- [ ] **Simular evento** pelo dashboard Asaas
- [ ] **Verificar logs**: Webhook recebeu evento
- [ ] **Validar processamento**: Conta ativada corretamente
- [ ] **Testar rollback**: Simular erro e verificar reversão

### ✅ Rollback

- [ ] **Simular erro** no checkout (ex: desativar webhook temporariamente)
- [ ] **Verificar**: Usuário foi removido (se primeira tentativa)
- [ ] **Verificar**: Nenhum dado órfão no banco
- [ ] **Re-ativar**: Webhook e tentar novamente

---

## 6. Monitoramento

### ✅ Configurar Alertas

- [ ] **Logs de erro** configurados
- [ ] **Alertas** para falhas de webhook
- [ ] **Monitoramento** de transações Asaas
- [ ] **Dashboard** de métricas (opcional)

### ✅ Logs Importantes

Verificar se estes logs aparecem corretamente:

```
✅ [createSubscriptionCheckout] Cliente Asaas criado: cus_xxxxx
✅ [createSubscriptionCheckout] Assinatura criada: sub_xxxxx
✅ [Webhook] Pagamento confirmado: pay_xxxxx
✅ [Rollback] Rollback completo concluído (se necessário)
```

- [ ] Logs de sucesso funcionando
- [ ] Logs de erro detalhados
- [ ] Logs de rollback (se aplicável)

---

## 7. Validações Finais

### ✅ Checklist Pré-Deploy

- [ ] **Credenciais**: API Key de PRODUÇÃO configurada
- [ ] **Domínio**: Cadastrado no Asaas e na aplicação
- [ ] **Webhook**: URL correta, ativo, v3 selecionada
- [ ] **Variáveis**: Todas configuradas sem valores de sandbox
- [ ] **Testes**: Fluxo completo testado
- [ ] **Rollback**: Funcionando corretamente
- [ ] **Logs**: Configurados e funcionando

### ✅ Segurança

- [ ] API Key **NÃO** está commitada no código
- [ ] Variáveis de ambiente protegidas no deploy
- [ ] Webhook valida autenticação (se implementado)
- [ ] HTTPS ativo em toda aplicação
- [ ] Dados sensíveis não aparecem nos logs

### ✅ Documentação

- [ ] Equipe sabe onde encontrar credenciais
- [ ] Processo de rollback documentado
- [ ] Troubleshooting documentado
- [ ] Contatos de suporte Asaas salvos

---

## 📞 Contatos Importantes

### Suporte Asaas

- **Site**: https://www.asaas.com
- **Suporte**: https://ajuda.asaas.com
- **Email**: suporte@asaas.com
- **Status**: https://status.asaas.com

### Documentação

- **API Docs**: https://docs.asaas.com
- **Webhooks**: https://docs.asaas.com/reference/webhooks
- **Checkouts**: https://docs.asaas.com/reference/checkout
- **Assinaturas**: https://docs.asaas.com/reference/assinaturas

---

## 🚨 Troubleshooting

### Erro: "Domínio não configurado"

**Solução**:
1. Verificar domínio cadastrado no Asaas
2. Confirmar que é EXATAMENTE o mesmo do `NEXT_PUBLIC_APP_URL`
3. Aguardar alguns minutos após cadastrar

### Erro: "Unauthorized" ou "Invalid API Key"

**Solução**:
1. Verificar que está usando API Key de PRODUÇÃO (não sandbox)
2. Confirmar que API Key está entre aspas duplas
3. Verificar se chave foi copiada corretamente

### Webhook não recebe eventos

**Solução**:
1. Verificar URL do webhook está correta e com HTTPS
2. Confirmar webhook está ATIVO
3. Testar com evento de teste do Asaas
4. Verificar logs da aplicação
5. Confirmar versão v3 selecionada

### Rollback não funciona

**Solução**:
1. Verificar logs de erro detalhados
2. Confirmar credenciais Supabase Admin
3. Testar em ambiente de desenvolvimento primeiro
4. Verificar permissões de delete no banco

---

## 📝 Notas Finais

### ⚠️ Diferenças entre Sandbox e Produção

| Aspecto | Sandbox | Produção |
|---------|---------|----------|
| **URL Base** | `https://sandbox.asaas.com/api/v3` | `https://api.asaas.com/api/v3` |
| **API Key** | `$aact_hmlg_...` | `$aact_...` |
| **Dashboard** | https://sandbox.asaas.com | https://www.asaas.com |
| **Pagamentos** | Simulados | Reais |
| **Webhooks** | Ngrok/localhost | Domínio produção |

### 🎯 Após Configuração

Depois de completar todos os itens:

1. ✅ Fazer deploy da aplicação
2. ✅ Testar fluxo completo end-to-end
3. ✅ Monitorar primeiras transações reais
4. ✅ Validar emails de confirmação
5. ✅ Acompanhar dashboard Asaas

---

**Data da Última Revisão**: Janeiro 2026  
**Responsável**: [Seu Nome/Equipe]  
**Status**: [ ] Pendente / [ ] Em Andamento / [ ] Completo
