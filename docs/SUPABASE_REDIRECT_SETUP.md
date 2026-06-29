# 🔧 Configuração de Redirect URLs no Supabase

## Problema

Quando o usuário clica no link de reset de senha, o Supabase redireciona para:
```
http://localhost:3000/#access_token=...&type=recovery
```

Mas o esperado seria:
```
http://localhost:3000/set-password#access_token=...&type=recovery
```

## Solução Implementada

### 1. Detecção Automática na Home Page

A página inicial (`app/page.tsx`) agora detecta automaticamente se há um token de recovery/invite no hash da URL e redireciona para `/set-password`:

```typescript
useEffect(() => {
  if (typeof window !== 'undefined') {
    const hash = window.location.hash;
    if (hash) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const type = hashParams.get('type');
      const accessToken = hashParams.get('access_token');

      if ((type === 'recovery' || type === 'invite') && accessToken) {
        router.push(`/set-password${hash}`);
      }
    }
  }
}, [router]);
```

### 2. Validação Melhorada em /set-password

A página `/set-password` agora tem logs detalhados e validação melhorada para garantir que os tokens sejam processados corretamente.

## ✅ Configuração Recomendada no Supabase

Para evitar que o Supabase ignore o `redirectTo`, siga estes passos:

### Passo 1: Acessar Configurações de URL

1. Acesse o **Supabase Dashboard**: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **Authentication** → **URL Configuration**

### Passo 2: Adicionar Redirect URLs

Na seção **Redirect URLs**, adicione as seguintes URLs:

**Desenvolvimento:**
```
http://localhost:3000/set-password
http://localhost:3000/*
```

**Produção (quando fizer deploy):**
```
https://seu-dominio.com/set-password
https://seu-dominio.com/*
```

### Passo 3: Configurar Site URL

Na seção **Site URL**, defina:

**Desenvolvimento:**
```
http://localhost:3000
```

**Produção:**
```
https://seu-dominio.com
```

### Passo 4: Salvar Configurações

Clique em **Save** para aplicar as mudanças.

## 🧪 Testando

### Teste 1: Reset de Senha Direto

1. Vá em `/manager-users`
2. Clique no dropdown de um operador
3. Clique em "Enviar reset de senha"
4. Verifique o email recebido
5. Clique no link do email

**Resultado Esperado:**
- URL inicial: `http://localhost:3000/#access_token=...&type=recovery`
- Redirecionamento automático: `http://localhost:3000/set-password#access_token=...&type=recovery`
- Página mostra formulário de definir senha
- Logs no console mostram: `🔐 Token encontrado: { accessToken: true, type: 'recovery' }`

### Teste 2: Console Logs

Abra o DevTools Console e verifique os logs:

```
🔍 Hash completo: #access_token=...&type=recovery&expires_in=3600...
🔐 Token encontrado: { accessToken: true, type: 'recovery' }
✅ Token válido detectado, usuário pode definir senha
```

## 🔄 Fluxo Completo

```
1. Manager clica "Enviar reset de senha"
         ↓
2. API: supabase.auth.resetPasswordForEmail(email, { redirectTo })
         ↓
3. Supabase envia email com link
         ↓
4. Usuário clica no link
         ↓
5. Supabase abre: http://localhost:3000/#access_token=...&type=recovery
         ↓
6. Página inicial detecta token no hash
         ↓
7. Redireciona automaticamente: /set-password#access_token=...
         ↓
8. Página /set-password valida token
         ↓
9. Usuário define nova senha
         ↓
10. Redireciona para dashboard
```

## ⚠️ Problemas Comuns

### Problema: Redirect não funciona

**Causa:** Supabase não tem a URL na whitelist

**Solução:** Adicione `http://localhost:3000/set-password` nas Redirect URLs do Supabase Dashboard

### Problema: Token inválido

**Causa:** Token expirou (válido por 24 horas)

**Solução:** Reenvie o email de reset

### Problema: Página fica em loop

**Causa:** Hash da URL está vazio ou malformado

**Solução:** Verifique os logs no console e peça novo email de reset

## 🎯 Variáveis de Ambiente

Certifique-se de que estas variáveis estão configuradas:

**.env.local (Desenvolvimento)**
```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
```

**.env.production (Produção)**
```bash
NEXT_PUBLIC_APP_URL=https://seu-dominio.com
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
```

## 📝 Notas Importantes

1. **Segurança**: O token de recovery expira em 24 horas
2. **Email Template**: Você pode customizar o template do email no Supabase Dashboard → Authentication → Email Templates → Reset Password
3. **Produção**: Não esqueça de atualizar `NEXT_PUBLIC_APP_URL` antes do deploy
4. **Whitelist**: Sempre adicione as URLs de produção na whitelist do Supabase

## 🆘 Suporte

Se ainda tiver problemas:

1. Verifique os logs no console do navegador
2. Verifique os logs do servidor Next.js
3. Verifique os logs no Supabase Dashboard → Logs
4. Teste com um email diferente
5. Limpe o cache do navegador

---

**Última atualização:** 21/11/2025
