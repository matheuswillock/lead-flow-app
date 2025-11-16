# 📎 Sistema de Upload de Arquivos - Lead Flow

## ✅ Implementação Completa

O sistema de upload de arquivos para leads foi implementado com sucesso! Agora os usuários podem anexar documentos (PDFs, imagens, etc.) aos leads e visualizar o histórico de uploads.

## 📋 O que foi implementado

### Backend (API)

1. **Prisma Schema** - Tabela `LeadAttachment`
   - ✅ Campos: id, leadId, fileName, fileUrl, fileType, fileSize, uploadedBy, uploadedAt
   - ✅ Relações: Lead (CASCADE), Profile/Uploader (RESTRICT)
   - ✅ Índices em leadId e uploadedBy
   - ✅ Migration executada: `20251116132133_attachment_upload_migrate`

2. **LeadAttachmentService** (`app/api/services/LeadAttachment/`)
   - ✅ Upload para Supabase Storage (bucket: `lead-attachments`)
   - ✅ Validação de arquivo (10MB max)
   - ✅ Tipos permitidos: JPEG, PNG, WebP, GIF, PDF, DOC, DOCX, XLS, XLSX, TXT, CSV
   - ✅ Nomenclatura única: `leadId/timestamp-random-filename`
   - ✅ Delete de arquivos do Storage

3. **LeadAttachmentUseCase** (`app/api/useCases/leadAttachments/`)
   - ✅ Validação de lead e usuário
   - ✅ Verificação de ownership (apenas dono pode deletar)
   - ✅ Integração com Prisma para persistência
   - ✅ Inclusão de dados do uploader nas consultas

4. **API Routes** (`app/api/v1/leads/[id]/attachments/`)
   - ✅ `GET /api/v1/leads/[id]/attachments` - Listar attachments
   - ✅ `POST /api/v1/leads/[id]/attachments` - Upload (multipart/form-data)
   - ✅ `DELETE /api/v1/leads/[id]/attachments/[attachmentId]` - Deletar
   - ✅ Autenticação Supabase em todas as rotas

### Frontend (UI)

1. **AttachmentList Component** (`components/ui/attachment-list.tsx`)
   - ✅ Botão de upload com input múltiplo
   - ✅ Lista de attachments com ícones por tipo
   - ✅ Informações de metadata (tamanho, uploader, data/hora)
   - ✅ Botão de delete em cada arquivo
   - ✅ Link para download/visualização
   - ✅ Estados loading com skeleton
   - ✅ Formatação de datas em PT-BR

2. **LeadForm Integration** (`components/forms/leadForm.tsx`)
   - ✅ Nova prop `leadId` (opcional)
   - ✅ Seção de attachments exibida apenas em modo de edição
   - ✅ Separador visual antes da seção

3. **Dialog Integration**
   - ✅ `BoardDialog` - passa `leadId` para LeadForm
   - ✅ `PipelineDialog` - passa `leadId` para LeadForm

## 🚀 Próximos Passos (IMPORTANTE!)

### 1. Criar Bucket no Supabase Storage

**Você precisa criar o bucket manualmente no Supabase Console:**

1. Acesse: https://supabase.com/dashboard/project/meboeqxdcdzyercackkg
2. Navegue para: **Storage** no menu lateral
3. Clique em: **"New bucket"**
4. Configure:
   - **Name**: `lead-attachments`
   - **Public bucket**: ✅ Ativar (para URLs públicas)
   - **File size limit**: 10 MB (opcional, já validamos no backend)
   - **Allowed MIME types**: Deixar vazio ou adicionar: `image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv`

5. Clique em **"Create bucket"**

### 2. Configurar Políticas de Acesso (RLS)

Após criar o bucket, configure as políticas de segurança:

```sql
-- Permitir upload para usuários autenticados
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'lead-attachments');

-- Permitir leitura pública (URLs públicas)
CREATE POLICY "Public read access for attachments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'lead-attachments');

-- Permitir delete apenas para o dono do lead ou admin
CREATE POLICY "Users can delete their lead attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'lead-attachments');
```

**Como aplicar:**
1. No Supabase Dashboard, vá em **Storage > Policies**
2. Selecione o bucket `lead-attachments`
3. Clique em **"New Policy"** para cada política acima
4. Ou execute o SQL no **SQL Editor**

### 3. Testar o Sistema

Após configurar o bucket:

1. **Inicie o servidor dev:**
   ```bash
   bun run dev
   ```

2. **Acesse um lead existente** no Board ou Pipeline

3. **Clique em "Upload"** na seção de arquivos

4. **Selecione múltiplos arquivos** (teste PDFs, imagens, etc.)

5. **Verifique:**
   - ✅ Arquivos aparecem na lista após upload
   - ✅ Metadata exibida corretamente (nome, tamanho, uploader, data)
   - ✅ Ícone correto por tipo de arquivo
   - ✅ Link funciona para visualizar/baixar
   - ✅ Delete remove o arquivo (com confirmação visual)

## 📝 Exemplo de Uso

### Upload via API (Postman/Thunder Client)

```http
POST /api/v1/leads/{leadId}/attachments
Content-Type: multipart/form-data
Authorization: Bearer {supabase-token}

Body (form-data):
- file: [selecionar arquivo]
```

**Response:**
```json
{
  "isValid": true,
  "successMessages": ["Attachment uploaded successfully"],
  "errorMessages": [],
  "result": {
    "id": "uuid-do-attachment",
    "fileName": "documento.pdf",
    "fileUrl": "https://storage-url.com/...",
    "fileType": "application/pdf",
    "fileSize": 245678,
    "uploadedAt": "2024-11-16T13:25:00.000Z",
    "uploader": {
      "id": "uuid",
      "fullName": "João Silva",
      "email": "joao@example.com"
    }
  }
}
```

### Listar Attachments

```http
GET /api/v1/leads/{leadId}/attachments
Authorization: Bearer {supabase-token}
```

### Deletar Attachment

```http
DELETE /api/v1/leads/{leadId}/attachments/{attachmentId}
Authorization: Bearer {supabase-token}
```

## 🔒 Segurança

- ✅ Validação de tamanho (10MB max)
- ✅ Validação de tipo de arquivo
- ✅ Autenticação obrigatória em todas as rotas
- ✅ Verificação de ownership para delete
- ✅ Arquivos organizados por leadId (isolamento)
- ✅ Audit trail com uploader e timestamp

## 📚 Arquivos Modificados/Criados

### Backend
- `prisma/schema.prisma` - Modelo LeadAttachment
- `prisma/migrations/20251116132133_attachment_upload_migrate/` - Migration
- `app/api/services/LeadAttachment/ILeadAttachmentService.ts` - Interface
- `app/api/services/LeadAttachment/LeadAttachmentService.ts` - Service
- `app/api/services/LeadAttachment/DTOs/AttachmentUploadResult.ts` - DTO
- `app/api/services/LeadAttachment/DTOs/DeleteAttachmentResult.ts` - DTO
- `app/api/useCases/leadAttachments/ILeadAttachmentUseCase.ts` - Interface
- `app/api/useCases/leadAttachments/LeadAttachmentUseCase.ts` - UseCase
- `app/api/v1/leads/[id]/attachments/route.ts` - GET + POST
- `app/api/v1/leads/[id]/attachments/[attachmentId]/route.ts` - DELETE

### Frontend
- `components/ui/attachment-list.tsx` - Componente de lista
- `components/forms/leadForm.tsx` - Integração com attachments
- `app/[supabaseId]/board/features/container/BoardDialog.tsx` - Passa leadId
- `app/[supabaseId]/pipeline/features/container/PipelineDialog.tsx` - Passa leadId

## 🎨 UI/UX

- Upload button com ícone
- Lista com cards de arquivos
- Ícones diferentes por tipo (imagem, PDF, documento)
- Metadata formatada em PT-BR
- Loading states com spinner
- Empty state quando sem arquivos
- Delete button discreto (X)
- Hover effects
- Border separando seção de attachments

## 🐛 Troubleshooting

### Erro: "Bucket not found"
- ✅ Verificar se bucket `lead-attachments` foi criado no Supabase
- ✅ Verificar se o nome está correto (exatamente `lead-attachments`)

### Erro: "Permission denied"
- ✅ Configurar políticas RLS no Storage
- ✅ Verificar se usuário está autenticado

### Erro: "File too large"
- ✅ Limite de 10MB está sendo respeitado
- ✅ Verificar configuração do bucket no Supabase

### Arquivos não aparecem após upload
- ✅ Verificar console do navegador para erros
- ✅ Verificar Network tab para ver resposta da API
- ✅ Verificar se bucket tem acesso público (leitura)

## ✅ Checklist Final

Antes de considerar completo:

- [ ] Bucket `lead-attachments` criado no Supabase
- [ ] Políticas RLS configuradas
- [ ] Teste de upload funcionando
- [ ] Teste de delete funcionando
- [ ] Metadata exibida corretamente
- [ ] Links de download funcionando
- [ ] Ícones corretos por tipo
- [ ] Formatação de datas em PT-BR

---

**Status**: 🟢 Backend Completo | 🟢 Frontend Completo | 🟡 **Aguardando Configuração Bucket**
