# 🚀 Configuração do Supabase Storage para Ícones de Perfil

## ⚡ Configuração Rápida (Via Dashboard)

### 1. Criar Bucket
1. Acesse seu [Supabase Dashboard](https://supabase.com/dashboard)
2. Vá para **Storage** no menu lateral
3. Clique em **Create bucket**
4. Configure:
   - **Name**: `profile-icons`
   - **Public bucket**: ✅ (habilitado)
   - Clique em **Create bucket**

### 2. Configurar Políticas de Segurança
1. No Supabase Dashboard, vá para **SQL Editor**
2. Clique em **New query**
3. Cole e execute o SQL abaixo:

```sql
-- Política para permitir visualização pública dos ícones
CREATE POLICY "Público pode visualizar ícones de perfil"
ON storage.objects
FOR SELECT
USING (bucket_id = 'profile-icons');

-- Política para permitir upload apenas para usuários autenticados dos próprios arquivos
CREATE POLICY "Usuários podem fazer upload dos próprios ícones"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-icons' 
  AND auth.uid()::text = split_part(name, '/', 1)
);

-- Política para permitir atualização apenas para usuários autenticados dos próprios arquivos
CREATE POLICY "Usuários podem atualizar os próprios ícones"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-icons' 
  AND auth.uid()::text = split_part(name, '/', 1)
)
WITH CHECK (
  bucket_id = 'profile-icons' 
  AND auth.uid()::text = split_part(name, '/', 1)
);

-- Política para permitir exclusão apenas para usuários autenticados dos próprios arquivos
CREATE POLICY "Usuários podem deletar os próprios ícones"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-icons' 
  AND auth.uid()::text = split_part(name, '/', 1)
);
```

### 3. Verificar Configuração
1. Volte para **Storage**
2. Verifique se o bucket `profile-icons` aparece na lista
3. Clique no bucket e confirme que está marcado como **Public**

## ✅ Após a Configuração

Reinicie o servidor de desenvolvimento:
```bash
npm run dev
```

Agora você pode testar o upload de ícones na página `/account`!

## 🔧 Funcionalidades Implementadas

- ✅ Upload de imagens (JPEG, PNG, WebP, GIF)
- ✅ Validação de tamanho (máximo 5MB)
- ✅ Drag & drop interface
- ✅ Preview da imagem antes do upload
- ✅ Exclusão de ícones existentes
- ✅ Fallback para avatar com iniciais
- ✅ Políticas de segurança RLS

## 🎯 Como Testar

1. Acesse `http://localhost:3000/account`
2. Arraste uma imagem para a área de upload ou clique para selecionar
3. Veja o preview da imagem
4. Clique em "Upload" para salvar
5. Para deletar, clique no ícone de lixeira que aparece no hover

---

**Nota**: O bucket precisa ser criado apenas uma vez. Após isso, toda a funcionalidade estará operacional!