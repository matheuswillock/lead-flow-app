# 🚀 Deploy na Vercel - Configuração

## 📋 Variáveis de Ambiente Obrigatórias

Configure todas as variáveis abaixo no painel da Vercel em **Settings → Environment Variables**:

### Supabase
```env
NEXT_PUBLIC_SUPABASE_URL=https://wcnxwdcoambpfwxwubka.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indjbnh3ZGNvYW1icGZ3eHd1YmthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwOTMzODcsImV4cCI6MjA4MTY2OTM4N30.H7TF9DRJLATSUWuNHrYyL2U9mQH-L6p6dmXI-eRmIT8
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indjbnh3ZGNvYW1icGZ3eHd1YmthIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjA5MzM4NywiZXhwIjoyMDgxNjY5Mzg3fQ.ejoZTxSwsxZ-tY_USiM22I0RkuLWD0XsBQlDV0RtGE0
```

### Database PostgreSQL
```env
POSTGRES_USER=postgres.wcnxwdcoambpfwxwubka
POSTGRES_PASSWORD=VFYIUFluzI3tEZy8
POSTGRES_HOST=aws-1-sa-east-1.pooler.supabase.com
POSTGRES_PORT=5432
POSTGRES_DB=postgres
DATABASE_URL=postgresql://postgres.wcnxwdcoambpfwxwubka:VFYIUFluzI3tEZy8@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.wcnxwdcoambpfwxwubka:VFYIUFluzI3tEZy8@aws-1-sa-east-1.pooler.supabase.com:5432/postgres
```

### Resend (Email Service)
```env
RESEND_API_KEY=re_ZJE9Awdj_FqQbwYbudjvZWSFCouFk8v6S
# ⚠️ MODO TESTE: Todos os emails vão para matheuswillock@gmail.com
EMAIL_TEST_MODE=true
RESEND_OWNER_EMAIL=matheuswillock@gmail.com
```

### Asaas (Payment Gateway)
```env
ASAAS_API_KEY=aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjQxNDJmZmEwLTg2YTItNDYwNi04MzU3LTNjMWQ5MzBmMGY1MDo6JGFhY2hfYzMzNTRkMDktYTkzYS00MmFjLTg3MWItMTM4NzA5M2NiMzc5
ASAAS_WALLET_ID=720c6e01-0cc3-4551-90fe-a0ad03a021f3
ASAAS_URL=https://sandbox.asaas.com
ASAAS_ENV=sandbox
ASAAS_WEBHOOK_TOKEN=2c8531b5221a6baf951cf3f3c5c3cb25069ee85fc18db7b5f9d7526a26bb4d56
```

## 🧪 Modo de Teste de Email

### O que é?
Com `EMAIL_TEST_MODE=true`, todos os emails enviados pela aplicação serão redirecionados para `matheuswillock@gmail.com`, independente do destinatário original.

### Como funciona?
1. **Email enviado para**: `joao@exemplo.com`
2. **Email realmente vai para**: `matheuswillock@gmail.com`
3. **Assunto modificado**: `[TESTE - Para: joao@exemplo.com] Bem-vindo ao Corretor Studio`
4. **Banner no email**: Mostra que é modo teste e qual seria o destinatário real

### Quando usar?
✅ **Usar em produção para testes iniciais**
- Testar fluxos de email em produção
- Verificar se emails estão sendo enviados corretamente
- Não enviar emails para clientes reais acidentalmente

❌ **Desabilitar quando**
- Projeto entrar em produção real
- Domínio verificado no Resend
- Pronto para enviar emails para clientes

### Como desabilitar?
Na Vercel, altere a variável:
```env
EMAIL_TEST_MODE=false
```

## 📧 Próximos Passos para Email em Produção

1. **Verificar domínio no Resend**
   - Acesse: https://resend.com/domains
   - Adicione: `corretorstudio.com.br`
   - Configure DNS records

2. **Atualizar EmailService.ts**
   ```typescript
   from: "Corretor Studio <no-reply@corretorstudio.com.br>"
   ```

3. **Desabilitar modo teste**
   ```env
   EMAIL_TEST_MODE=false
   ```

## 🔄 Webhooks do Asaas

⚠️ **IMPORTANTE**: Webhooks do Asaas precisam de URL pública.

### Durante Deploy
1. A URL da Vercel será: `https://seu-app.vercel.app`
2. Configure no Asaas: `https://seu-app.vercel.app/api/webhooks/asaas`
3. Valide o webhook token

### Configuração no Asaas
- Acesse: https://sandbox.asaas.com/config/webhook
- URL de notificação: `https://seu-app.vercel.app/api/webhooks/asaas`
- Eventos: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`

## 🚀 Deploy Steps

1. **Conectar repositório GitHub**
   - Importe o repositório na Vercel
   - Selecione branch: `main` ou `develop`

2. **Configurar variáveis de ambiente**
   - Copie todas as variáveis acima
   - Cole em Settings → Environment Variables
   - Aplique para: Production, Preview e Development

3. **Deploy**
   - Clique em Deploy
   - Aguarde build completar (~2-5 minutos)

4. **Testar**
   - Acesse a URL da Vercel
   - Faça login
   - Teste fluxo de criação de conta
   - Verifique emails no `matheuswillock@gmail.com`

## 📊 Monitoramento

### Logs de Email (Resend)
- Dashboard: https://resend.com/emails
- Veja todos os emails enviados
- Status de entrega
- Erros e bounces

### Logs da Aplicação (Vercel)
- Dashboard → Deployments → Logs
- Verifique erros de runtime
- Monitore webhooks

### Database (Supabase)
- Dashboard: https://supabase.com
- Table Editor: Verifique dados
- Logs: Monitore queries

## ⚠️ Checklist Pré-Deploy

- [ ] Todas as variáveis de ambiente configuradas
- [ ] `EMAIL_TEST_MODE=true` para testes iniciais
- [ ] Asaas em modo sandbox (`ASAAS_ENV=sandbox`)
- [ ] Database URL correta (Supabase)
- [ ] Supabase redirect URLs incluem domínio Vercel
- [ ] Build local funcionando (`bun run build`)
- [ ] Migrações do Prisma aplicadas

## 🔒 Supabase Redirect URLs

Adicione no Supabase Dashboard → Authentication → URL Configuration:

```
https://seu-app.vercel.app/api/auth/callback
https://seu-app.vercel.app/set-password
https://seu-app.vercel.app/operator-confirmed
https://seu-app.vercel.app/pix-confirmed
```

## 💡 Dicas

1. **Sempre use Preview Deployments**
   - Teste em preview antes de mergear para main
   - Vercel cria URLs temporárias para cada PR

2. **Ambiente de staging**
   - Considere ter uma branch `staging` separada
   - Configure variáveis diferentes para staging vs produção

3. **Monitoramento de emails**
   - Verifique regularmente o dashboard do Resend
   - Configure alertas para falhas de email

4. **Rollback rápido**
   - Vercel permite rollback instantâneo
   - Dashboard → Deployments → Promote to Production

---

## 🆘 Troubleshooting

### Email não chega
1. Verifique `EMAIL_TEST_MODE=true`
2. Confirme `RESEND_API_KEY` correta
3. Cheque logs no Resend dashboard
4. Verifique spam/lixeira

### Webhook não funciona
1. Verifique URL pública da Vercel
2. Confirme `ASAAS_WEBHOOK_TOKEN` correto
3. Teste endpoint manualmente
4. Verifique logs da Vercel

### Database connection error
1. Confirme `DATABASE_URL` e `DIRECT_URL`
2. Verifique se IP da Vercel está permitido no Supabase
3. Teste conexão direta com Prisma Studio

### Build falha
1. Execute `bun run build` localmente
2. Verifique erros de TypeScript
3. Confirme todas as dependências em `package.json`
4. Limpe cache: Vercel Dashboard → Settings → Clear Cache

---

📅 **Última atualização**: Janeiro 2026
