# 🔐 Políticas RLS para Supabase Storage

Este documento contém as políticas de segurança (Row-Level Security) necessárias para os buckets do Supabase Storage.

## 📋 Como Aplicar

1. Acesse o Supabase Dashboard: https://supabase.com/dashboard/project/meboeqxdcdzyercackkg
2. Vá em **SQL Editor** (menu lateral esquerdo)
3. Clique em **New Query**
4. Cole os comandos SQL abaixo
5. Clique em **Run** ou pressione `Ctrl+Enter`

---

## 🗂️ Bucket: `lead-attachments`

### Política 1: Upload de Anexos (Authenticated Users)

Permite que usuários autenticados façam upload de arquivos no bucket `lead-attachments`.

```sql
-- Criar política de INSERT (upload) para lead-attachments
CREATE POLICY "Authenticated users can upload lead attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lead-attachments'
);
```

### Política 2: Leitura de Anexos (Public)

Permite que qualquer pessoa leia os arquivos (já que o bucket é público).

```sql
-- Criar política de SELECT (read) para lead-attachments
CREATE POLICY "Public can read lead attachments"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'lead-attachments'
);
```

### Política 3: Atualização de Anexos (Authenticated Users)

Permite que usuários autenticados atualizem arquivos que enviaram.

```sql
-- Criar política de UPDATE para lead-attachments
CREATE POLICY "Authenticated users can update their lead attachments"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'lead-attachments'
  AND auth.uid() = owner
)
WITH CHECK (
  bucket_id = 'lead-attachments'
);
```

### Política 4: Deleção de Anexos (Authenticated Users)

Permite que usuários autenticados deletem arquivos que enviaram.

```sql
-- Criar política de DELETE para lead-attachments
CREATE POLICY "Authenticated users can delete their lead attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'lead-attachments'
  AND auth.uid() = owner
);
```

---

## 👤 Bucket: `profile-icons`

### Política 1: Upload de Ícones (Authenticated Users)

```sql
-- Criar política de INSERT (upload) para profile-icons
CREATE POLICY "Authenticated users can upload profile icons"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-icons'
);
```

### Política 2: Leitura de Ícones (Public)

```sql
-- Criar política de SELECT (read) para profile-icons
CREATE POLICY "Public can read profile icons"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'profile-icons'
);
```

### Política 3: Atualização de Ícones (Authenticated Users)

```sql
-- Criar política de UPDATE para profile-icons
CREATE POLICY "Authenticated users can update their profile icons"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-icons'
  AND auth.uid() = owner
)
WITH CHECK (
  bucket_id = 'profile-icons'
);
```

### Política 4: Deleção de Ícones (Authenticated Users)

```sql
-- Criar política de DELETE para profile-icons
CREATE POLICY "Authenticated users can delete their profile icons"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-icons'
  AND auth.uid() = owner
);
```

---

## 🚀 Script Completo (Executar Tudo de Uma Vez)

Cole este bloco inteiro no SQL Editor:

```sql
-- ============================================
-- POLÍTICAS RLS PARA STORAGE BUCKETS
-- ============================================

-- LEAD ATTACHMENTS BUCKET
-- ============================================

-- Upload de anexos (authenticated)
CREATE POLICY "Authenticated users can upload lead attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lead-attachments'
);

-- Leitura de anexos (public)
CREATE POLICY "Public can read lead attachments"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'lead-attachments'
);

-- Atualização de anexos (authenticated, owner)
CREATE POLICY "Authenticated users can update their lead attachments"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'lead-attachments'
  AND auth.uid() = owner
)
WITH CHECK (
  bucket_id = 'lead-attachments'
);

-- Deleção de anexos (authenticated, owner)
CREATE POLICY "Authenticated users can delete their lead attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'lead-attachments'
  AND auth.uid() = owner
);

-- PROFILE ICONS BUCKET
-- ============================================

-- Upload de ícones (authenticated)
CREATE POLICY "Authenticated users can upload profile icons"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-icons'
);

-- Leitura de ícones (public)
CREATE POLICY "Public can read profile icons"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'profile-icons'
);

-- Atualização de ícones (authenticated, owner)
CREATE POLICY "Authenticated users can update their profile icons"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-icons'
  AND auth.uid() = owner
)
WITH CHECK (
  bucket_id = 'profile-icons'
);

-- Deleção de ícones (authenticated, owner)
CREATE POLICY "Authenticated users can delete their profile icons"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-icons'
  AND auth.uid() = owner
);
```

---

## ✅ Verificação

Após executar os comandos, verifique se as políticas foram criadas:

1. Vá em **Storage** → **Policies**
2. Você deve ver 8 políticas no total (4 para cada bucket)
3. Teste fazer upload de um arquivo novamente

---

## 🔍 Troubleshooting

### Erro: "policy already exists"

Se você ver este erro, significa que alguma política já foi criada. Para removê-las e recriar:

```sql
-- Remover todas as políticas dos buckets
DROP POLICY IF EXISTS "Authenticated users can upload lead attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public can read lead attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their lead attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their lead attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload profile icons" ON storage.objects;
DROP POLICY IF EXISTS "Public can read profile icons" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their profile icons" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their profile icons" ON storage.objects;
```

Depois execute o script completo novamente.

---

## 📚 Referências

- [Supabase Storage RLS Documentation](https://supabase.com/docs/guides/storage/security/access-control)
- [Row Level Security Policies](https://supabase.com/docs/guides/auth/row-level-security)
