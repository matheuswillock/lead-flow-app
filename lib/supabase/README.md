# 🗄️ Supabase Storage Library

Biblioteca centralizada para gerenciamento de uploads e storage no Supabase.

## 📁 Estrutura

```
lib/supabase/
├── auth-sessions.ts    # Gerenciamento de sessões de autenticação
├── browser.ts          # Cliente Supabase para browser
├── server.ts           # Cliente Supabase para server-side
└── storage.ts          # 🆕 Biblioteca de Storage (NOVA)
```

## 🎯 Objetivo

A lib `storage.ts` foi criada para:

1. ✅ **Centralizar configurações** de buckets do Supabase Storage
2. ✅ **Padronizar validações** de arquivos (tamanho, tipo MIME)
3. ✅ **Simplificar uploads/deletes** com métodos reutilizáveis
4. ✅ **Tornar Services agnósticos** à implementação do storage
5. ✅ **Melhorar resiliência** com tratamento de erros padronizado

## 🏗️ Arquitetura

### Antes (Código duplicado)

```typescript
// ProfileIconService.ts
export class ProfileIconService {
  private readonly BUCKET_NAME = process.env.SUPABASE_PROFILE_ICONS_BUCKET || "";
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024;
  private readonly ALLOWED_TYPES = ["image/jpeg", "image/png", ...];
  
  async uploadProfileIcon(file: File, userId: string) {
    // Validações manuais
    if (file.size > this.MAX_FILE_SIZE) { ... }
    
    // Setup Supabase client
    const supabase = createSupabaseAdmin();
    
    // Upload manual
    const { data, error } = await supabase.storage.from(this.BUCKET_NAME)...
  }
}

// LeadAttachmentService.ts (CÓDIGO DUPLICADO!)
export class LeadAttachmentService {
  private readonly BUCKET_NAME = process.env.SUPABASE_LEAD_ATTACHMENTS_BUCKET || "";
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024;
  private readonly ALLOWED_TYPES = ["application/pdf", "image/jpeg", ...];
  
  async uploadAttachment(file: File, leadId: string) {
    // Mesmas validações repetidas
    // Mesmo setup repetido
    // Mesma lógica de upload repetida
  }
}
```

### Depois (Código limpo e reutilizável)

```typescript
// storage.ts (Biblioteca centralizada)
export class SupabaseStorageService {
  static async uploadFile(file, bucketName, entityId, fileName, prefix) {
    // Validações centralizadas
    // Setup centralizado
    // Lógica de upload centralizada
  }
}

// ProfileIconService.ts (Limpo e agnóstico)
export class ProfileIconService {
  async uploadProfileIcon(file: File, userId: string) {
    const result = await SupabaseStorageService.uploadFile(
      file,
      STORAGE_BUCKETS.PROFILE_ICONS,
      userId,
      file.name,
      'icon'
    );
    
    return result;
  }
}

// LeadAttachmentService.ts (Limpo e agnóstico)
export class LeadAttachmentService {
  async uploadAttachment(file: File, leadId: string, fileName: string) {
    const result = await SupabaseStorageService.uploadFile(
      file,
      STORAGE_BUCKETS.LEAD_ATTACHMENTS,
      leadId,
      fileName,
      'attachment'
    );
    
    return result;
  }
}
```

## 🚀 Como Usar

### 1. Importar a biblioteca

```typescript
import { 
  SupabaseStorageService, 
  STORAGE_BUCKETS 
} from "@/lib/supabase/storage";
```

### 2. Upload de arquivo

```typescript
const result = await SupabaseStorageService.uploadFile(
  file,                              // File object
  STORAGE_BUCKETS.PROFILE_ICONS,     // Bucket name
  userId,                            // Entity ID (usado como pasta)
  file.name,                         // Nome original do arquivo
  'icon'                             // Prefixo opcional
);

if (result.success) {
  console.log('File ID:', result.fileId);
  console.log('Public URL:', result.publicUrl);
} else {
  console.error('Error:', result.error);
}
```

### 3. Delete de arquivo

```typescript
const result = await SupabaseStorageService.deleteFile(
  fileId,                            // ID/path do arquivo
  STORAGE_BUCKETS.PROFILE_ICONS      // Bucket name
);

if (result.success) {
  console.log('File deleted successfully');
} else {
  console.error('Error:', result.error);
}
```

### 4. Obter URL pública

```typescript
const publicUrl = SupabaseStorageService.getPublicUrl(
  fileId,
  STORAGE_BUCKETS.LEAD_ATTACHMENTS
);
```

### 5. Listar arquivos de uma entidade

```typescript
const result = await SupabaseStorageService.listFiles(
  leadId,
  STORAGE_BUCKETS.LEAD_ATTACHMENTS
);

if (result.success) {
  console.log('Files:', result.files);
}
```

## 📊 Buckets Configurados

### `STORAGE_BUCKETS.PROFILE_ICONS`

- **Tamanho máximo**: 5MB
- **Tipos permitidos**: JPEG, PNG, WebP, GIF
- **Uso**: Fotos de perfil de usuários
- **Estrutura**: `{userId}/{prefix}-{timestamp}-{random}.{ext}`

### `STORAGE_BUCKETS.LEAD_ATTACHMENTS`

- **Tamanho máximo**: 10MB
- **Tipos permitidos**: PDF, DOC, DOCX, XLS, XLSX, JPEG, PNG, WebP, GIF, TXT
- **Uso**: Anexos de leads (contratos, documentos, fotos)
- **Estrutura**: `{leadId}/{prefix}-{timestamp}-{random}.{ext}`

## 🔧 Validações Automáticas

A biblioteca valida automaticamente:

1. ✅ **Tamanho do arquivo** (baseado no bucket)
2. ✅ **Tipo MIME** (baseado no bucket)
3. ✅ **Existência do bucket** configurado
4. ✅ **Cliente Supabase** inicializado corretamente

Erros retornam mensagens descritivas:

```typescript
{
  success: false,
  error: "Arquivo muito grande. Tamanho máximo: 5.00MB"
}

{
  success: false,
  error: "Tipo de arquivo não permitido. Tipos aceitos: image/jpeg, image/png, ..."
}
```

## 🛡️ Segurança

- **RLS Bypass**: Usa `createSupabaseAdmin()` para bypassar RLS policies
- **Validação Server-Side**: Todas as validações ocorrem no servidor
- **Nome de arquivo único**: Gerado automaticamente para evitar conflitos
- **Paths seguros**: Arquivos organizados por entidade (userId, leadId)

## 🚨 Tratamento de Erros

### Mapeamento Automático de Erros

A biblioteca inclui `StorageErrorMapper` que converte erros técnicos do Supabase em mensagens amigáveis:

```typescript
// Erro técnico do Supabase
"new row violates row-level security policy"

// Mensagem amigável ao usuário
"Você não tem permissão para fazer upload deste arquivo"
```

### Erros Mapeados

| Erro Original | Mensagem ao Usuário |
|--------------|---------------------|
| `permission denied` | Você não tem permissão para acessar este arquivo |
| `Bucket not found` | Erro de configuração: bucket de storage não encontrado |
| `file already exists` | Um arquivo com este nome já existe |
| `payload too large` | Arquivo muito grande para upload |
| `network error` | Erro de conexão. Verifique sua internet e tente novamente |
| `quota exceeded` | Limite de armazenamento atingido |

### Mensagem Genérica

Para erros não mapeados:
```
"Ocorreu um erro ao processar o arquivo. Tente novamente"
```

### Como Usar

O mapeamento é automático. Os métodos `uploadFile()` e `deleteFile()` já retornam erros mapeados:

```typescript
const result = await SupabaseStorageService.uploadFile(...);

if (!result.success) {
  // result.error já está mapeado para mensagem amigável
  toast.error(result.error); // Exibe mensagem clara ao usuário
}
```

### Mapeamento Manual

Se precisar mapear um erro manualmente:

```typescript
import { StorageErrorMapper } from "@/lib/supabase/storage";

try {
  // operação que pode falhar
} catch (error) {
  const friendlyMessage = StorageErrorMapper.mapError(error);
  console.log(friendlyMessage); // Mensagem amigável
}
```

### Com Contexto Adicional

```typescript
const message = StorageErrorMapper.mapErrorWithContext(
  error, 
  "Upload de ícone de perfil"
);
// Resultado: "Upload de ícone de perfil: Arquivo muito grande para upload"
```

## � Logging e Monitoramento

A biblioteca registra automaticamente todos os erros no console do servidor para facilitar monitoramento e debugging.

### Logs Automáticos

**Quando ocorrem erros:**

1. **Validação de arquivo:**
```typescript
[SupabaseStorageService.uploadFile] Validação falhou: {
  bucketName: 'profile-icons',
  fileName: 'foto.jpg',
  fileSize: 6000000,
  fileType: 'image/jpeg',
  error: 'Arquivo muito grande. Tamanho máximo: 5.00MB'
}
```

2. **Erro no upload:**
```typescript
[SupabaseStorageService.uploadFile] Erro no upload para Supabase: {
  bucketName: 'lead-attachments',
  fileName: 'contrato.pdf',
  uniqueFileName: 'lead123/attachment-1234567890-abc.pdf',
  fileSize: 2500000,
  fileType: 'application/pdf',
  entityId: 'lead123',
  error: { message: 'permission denied', ... }
}
```

3. **Erro no delete:**
```typescript
[SupabaseStorageService.deleteFile] Erro ao deletar do Supabase: {
  bucketName: 'profile-icons',
  fileId: 'user456/icon-1234567890-xyz.jpg',
  error: { message: 'file not found', ... }
}
```

4. **Mapeamento de erros:**
```typescript
[StorageErrorMapper] Mapeando erro: { message: 'payload too large', ... }
[StorageErrorMapper] Erro não mapeado detectado: { customError: 'unknown' }
```

### Informações Registradas

Cada log de erro inclui:
- ✅ **Contexto**: Qual operação estava sendo executada
- ✅ **Bucket**: Em qual bucket ocorreu o erro
- ✅ **Arquivo**: Nome original e único do arquivo
- ✅ **Entidade**: ID da entidade (userId, leadId)
- ✅ **Detalhes**: Tamanho, tipo MIME, etc.
- ✅ **Erro original**: Mensagem de erro completa do Supabase

### Monitoramento em Produção

Para facilitar análise em produção, você pode:

1. **Usar ferramentas de log agregation** (Datadog, Sentry, LogRocket)
2. **Filtrar por prefixo**: `[SupabaseStorageService.*]` ou `[StorageErrorMapper]`
3. **Alertas**: Configurar alertas para erros recorrentes
4. **Análise de tendências**: Identificar erros mais comuns

### Exemplo de Integração com Sentry

```typescript
// Em SupabaseStorageService.uploadFile
if (uploadError) {
  const errorContext = {
    bucketName,
    fileName: originalFileName,
    fileSize: file.size,
    entityId,
  };
  
  console.error('[SupabaseStorageService.uploadFile] Erro no upload:', errorContext);
  
  // Opcional: Enviar para Sentry
  if (typeof Sentry !== 'undefined') {
    Sentry.captureException(uploadError, { extra: errorContext });
  }
  
  const mappedError = StorageErrorMapper.mapError(uploadError);
  return { success: false, error: mappedError };
}
```

## �📝 Variáveis de Ambiente Necessárias

```env
# Supabase Storage Buckets
SUPABASE_LEAD_ATTACHMENTS_BUCKET=lead-attachments
SUPABASE_PROFILE_ICONS_BUCKET=profile-icons
```

## 🔄 Migração de Código Existente

### ProfileIconService

**Antes:**
```typescript
private readonly BUCKET_NAME = process.env.SUPABASE_PROFILE_ICONS_BUCKET || "";
private readonly MAX_FILE_SIZE = 5 * 1024 * 1024;
private readonly ALLOWED_TYPES = ["image/jpeg", ...];

async uploadProfileIcon(file: File, userId: string) {
  // 50+ linhas de código
  const validation = this.validateFile(file);
  const supabase = createSupabaseAdmin();
  const fileName = `${userId}/${Date.now()}...`;
  const arrayBuffer = await file.arrayBuffer();
  const { data, error } = await supabase.storage.from(...)...
}
```

**Depois:**
```typescript
async uploadProfileIcon(file: File, userId: string) {
  const result = await SupabaseStorageService.uploadFile(
    file,
    STORAGE_BUCKETS.PROFILE_ICONS,
    userId,
    file.name,
    'icon'
  );
  
  return {
    success: result.success,
    iconId: result.fileId,
    publicUrl: result.publicUrl,
    error: result.error
  };
}
```

**Redução**: De ~50 linhas para ~15 linhas ✨

### LeadAttachmentService

**Antes:**
```typescript
private readonly BUCKET_NAME = process.env.SUPABASE_LEAD_ATTACHMENTS_BUCKET || "";
private readonly MAX_FILE_SIZE = 10 * 1024 * 1024;
private readonly ALLOWED_TYPES = [...];

async uploadAttachment(file, leadId, fileName) {
  // 50+ linhas de código duplicado
}
```

**Depois:**
```typescript
async uploadAttachment(file, leadId, fileName) {
  const result = await SupabaseStorageService.uploadFile(
    file,
    STORAGE_BUCKETS.LEAD_ATTACHMENTS,
    leadId,
    fileName,
    'attachment'
  );
  
  return result;
}
```

**Redução**: De ~50 linhas para ~10 linhas ✨

## 🎯 Benefícios

1. **DRY (Don't Repeat Yourself)**: Código reutilizável
2. **Single Responsibility**: Services focam em lógica de negócio
3. **Testabilidade**: Fácil de mockar e testar
4. **Manutenibilidade**: Mudanças centralizadas
5. **Consistência**: Comportamento uniforme em todo o app
6. **Documentação**: Código auto-documentado
7. **Type Safety**: TypeScript completo
8. **Error Handling**: Tratamento padronizado

## 📚 API Reference

### `SupabaseStorageService`

#### Métodos Estáticos

| Método | Descrição | Retorno |
|--------|-----------|---------|
| `uploadFile()` | Upload de arquivo | `Promise<StorageUploadResult>` |
| `deleteFile()` | Delete de arquivo | `Promise<StorageDeleteResult>` |
| `getPublicUrl()` | Obter URL pública | `string \| null` |
| `listFiles()` | Listar arquivos de entidade | `Promise<{success, files, error}>` |
| `validateFile()` | Validar arquivo | `FileValidationResult` |
| `generateUniqueFileName()` | Gerar nome único | `string` |
| `getBucketConfig()` | Obter config do bucket | `BucketConfig \| null` |
| `getAllBucketsInfo()` | Info de todos os buckets | `Array<BucketInfo>` |

#### Tipos

```typescript
interface StorageUploadResult {
  success: boolean;
  fileId?: string;
  publicUrl?: string;
  error?: string;
}

interface StorageDeleteResult {
  success: boolean;
  error?: string;
}

interface FileValidationResult {
  isValid: boolean;
  error?: string;
}
```

## 🧪 Testes

```typescript
// Exemplo de teste
describe('SupabaseStorageService', () => {
  it('should upload file successfully', async () => {
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
    
    const result = await SupabaseStorageService.uploadFile(
      file,
      STORAGE_BUCKETS.PROFILE_ICONS,
      'user-123',
      'test.jpg'
    );
    
    expect(result.success).toBe(true);
    expect(result.fileId).toBeDefined();
    expect(result.publicUrl).toBeDefined();
  });
  
  it('should reject file too large', async () => {
    const largeFile = new File([new ArrayBuffer(6 * 1024 * 1024)], 'large.jpg');
    
    const result = await SupabaseStorageService.uploadFile(
      largeFile,
      STORAGE_BUCKETS.PROFILE_ICONS,
      'user-123',
      'large.jpg'
    );
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Tamanho máximo');
  });
});
```

## 🔗 Links Relacionados

- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [SUPABASE_STORAGE_RLS_POLICIES.md](/docs/SUPABASE_STORAGE_RLS_POLICIES.md)
- [FILE_UPLOAD_IMPLEMENTATION.md](/docs/FILE_UPLOAD_IMPLEMENTATION.md)

## 📝 Changelog

### v1.0.0 (2026-01-18)
- ✨ Criação da biblioteca `SupabaseStorageService`
- 🔧 Configurações centralizadas de buckets
- ✅ Validações automáticas de arquivos
- 🛠️ Refatoração de `ProfileIconService`
- 🛠️ Refatoração de `LeadAttachmentService`
- 📚 Documentação completa

---

💡 **Dica**: Use sempre `STORAGE_BUCKETS` ao invés de strings hardcoded para garantir type safety e evitar erros de digitação.
