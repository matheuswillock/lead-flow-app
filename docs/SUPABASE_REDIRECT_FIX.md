# 🔧 Corrigir Redirect URLs do Supabase

## Problema

Os e-mails de recuperação de senha estão sendo enviados com `http://localhost:3000` ao invés da URL do ngrok configurada em `NEXT_PUBLIC_APP_URL`.

**Causa**: O Supabase só aceita redirect URLs que estão explicitamente configuradas na lista de URLs permitidas.

## ✅ Solução

### Passo 1: Acessar configurações do Supabase

1. Acesse: https://supabase.com/dashboard/project/wcnxwdcoambpfwxwubka
2. Vá em **Authentication** → **URL Configuration**

### Passo 2: Adicionar URLs do ngrok

Na seção **Redirect URLs**, adicione:

```
https://nonzero-rodrick-mentholated.ngrok-free.dev/**
https://nonzero-rodrick-mentholated.ngrok-free.dev/set-password
https://nonzero-rodrick-mentholated.ngrok-free.dev/dashboard
```

### Passo 3: Site URL

Também atualize o **Site URL** para:

```
https://nonzero-rodrick-mentholated.ngrok-free.dev
```

### Passo 4: Salvar e Testar

1. Clique em **Save**
2. Aguarde alguns segundos para as configurações propagarem
3. Teste novamente o fluxo de recuperação de senha

## 📝 URLs que devem estar configuradas

### Desenvolvimento (ngrok):
- `https://nonzero-rodrick-mentholated.ngrok-free.dev/**`

### Produção (quando deployar):
- `https://www.corretorstudio.com.br/**` (ou sua URL de produção)

### Localhost (para desenvolvimento local):
- `http://localhost:3000/**`

## 🔍 Verificação

Depois de configurar, verifique nos logs do servidor que o `redirectTo` está sendo passado corretamente:

```
🔗 [Forgot Password] Redirect URL: https://nonzero-rodrick-mentholated.ngrok-free.dev/set-password
```

O e-mail deve então conter a URL correta do ngrok.

## ⚠️ Importante

- O Supabase **ignora** o `redirectTo` se a URL não estiver na lista permitida
- Use o padrão `/**` para permitir qualquer rota do domínio
- Sempre adicione a URL de produção quando fizer deploy
