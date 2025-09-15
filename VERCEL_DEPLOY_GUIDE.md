# 🚀 Configuração de Deploy na Vercel

## ⚠️ Variáveis de Ambiente Necessárias

Para que o deploy funcione corretamente na Vercel, você **DEVE** configurar as seguintes variáveis de ambiente no painel da Vercel:

### 📋 Variáveis Obrigatórias

1. **NEXT_PUBLIC_SUPABASE_URL**
   - Valor: URL do seu projeto Supabase
   - Exemplo: `https://ncpzzfeiumvhvsapebxy.supabase.co`

2. **NEXT_PUBLIC_SUPABASE_ANON_KEY**
   - Valor: Chave pública (anon key) do Supabase
   - Exemplo: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

3. **SUPABASE_SERVICE_ROLE_KEY**
   - Valor: Chave de service role do Supabase (privada)
   - Exemplo: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - ⚠️ **IMPORTANTE**: Esta chave é sensível e deve ter acesso admin

4. **DATABASE_URL**
   - Valor: URL de conexão com o banco PostgreSQL do Supabase
   - Exemplo: `postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres`

5. **DIRECT_URL**
   - Valor: URL direta para conexão com Prisma
   - Exemplo: `postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres`

## 🔧 Como Configurar na Vercel

### Método 1: Interface Web
1. Acesse o [dashboard da Vercel](https://vercel.com/dashboard)
2. Selecione seu projeto
3. Vá para **Settings** → **Environment Variables**
4. Adicione cada variável:
   - **Key**: Nome da variável (ex: `NEXT_PUBLIC_SUPABASE_URL`)
   - **Value**: Valor correspondente
   - **Environments**: Selecione `Production`, `Preview`, e `Development`

### Método 2: CLI da Vercel
```bash
# Instalar CLI da Vercel (se necessário)
npm i -g vercel

# Configurar variáveis
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add DATABASE_URL
vercel env add DIRECT_URL
```

## 🔍 Onde Encontrar os Valores

### Supabase Dashboard
1. Acesse [app.supabase.com](https://app.supabase.com)
2. Selecione seu projeto
3. Vá para **Settings** → **API**

**Para encontrar:**
- **URL**: Campo "Project URL"
- **ANON_KEY**: Campo "anon public"
- **SERVICE_ROLE_KEY**: Campo "service_role" (clique em "Reveal")

### Database URLs
1. No Supabase Dashboard
2. Vá para **Settings** → **Database**
3. Na seção "Connection string":
   - **URI**: Use para DATABASE_URL e DIRECT_URL
   - Substitua `[YOUR-PASSWORD]` pela senha do banco

## 🐛 Resolução de Problemas

### Erro: "Supabase URL or Service Key is not defined"
- ✅ **Solução**: Configurar `SUPABASE_SERVICE_ROLE_KEY` na Vercel
- ✅ **Verificar**: Todas as 5 variáveis estão definidas
- ✅ **Redeploy**: Fazer novo deploy após adicionar variáveis

### Erro: "Cannot connect to database"
- ✅ **Verificar**: `DATABASE_URL` e `DIRECT_URL` estão corretas
- ✅ **Senha**: Confirmar senha do banco no Supabase
- ✅ **Formato**: `postgresql://postgres:SENHA@db.PROJETO.supabase.co:5432/postgres`

### Erro: "Authentication failed"
- ✅ **Verificar**: `NEXT_PUBLIC_SUPABASE_ANON_KEY` está correta
- ✅ **Verificar**: `SUPABASE_SERVICE_ROLE_KEY` está correta
- ✅ **Copiar**: Usar "Copy" no dashboard do Supabase (não digitar)

## 🚀 Após Configurar

1. **Redeploy**: Faça um novo deploy na Vercel
2. **Teste**: Acesse o site e teste funcionalidades
3. **Logs**: Check os logs da Vercel se houver problemas

---

## 📝 Checklist de Deploy

- [ ] Todas as 5 variáveis configuradas na Vercel
- [ ] Build local funcionando (`bun run build`)
- [ ] Supabase Storage bucket criado (`profile-icons`)
- [ ] Prisma migrations aplicadas
- [ ] Redeploy feito na Vercel

✅ **Status**: Build corrigido e pronto para deploy!