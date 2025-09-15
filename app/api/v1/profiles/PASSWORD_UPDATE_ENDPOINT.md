# Endpoint de Atualização de Senha

## Resumo da Implementação

### 📍 **Endpoint Criado**
**PUT** `/api/v1/profiles/[supabaseId]/password`

### 🎯 **Funcionalidade**
- Atualiza **apenas a senha** do usuário
- Recebe `supabaseId` via parâmetro de rota
- Recebe `password` no body da requisição
- Atualiza **somente no Supabase Auth** (não no banco Profile)
- Retorna **apenas uma mensagem de sucesso**

### 🏗️ **Arquitetura Implementada**

#### 1. **Repository Layer** (`ProfileRepository.ts`)
```typescript
async updatePassword(supabaseId: string, newPassword: string): Promise<boolean>
```
- Atualiza senha via `supabase.auth.admin.updateUserById()`
- Retorna `boolean` indicando sucesso/falha

#### 2. **Use Case Layer** (`ProfileUseCase.ts`)
```typescript
async updatePassword(supabaseId: string, newPassword: string): Promise<Output>
```
- Validações de entrada (supabaseId, senha)
- Verificação de existência do profile
- Validações de senha (tamanho, formato)
- Retorna Output com mensagem "Password updated successfully"

#### 3. **DTO Layer** (`requestToUpdatePassword.ts`)
```typescript
interface RequestToUpdatePassword {
  password: string;
}
```
- Validações robustas de senha
- Regex para força da senha (letra + número)

#### 4. **API Route** (`[supabaseId]/password/route.ts`)
```typescript
PUT /api/v1/profiles/[supabaseId]/password
```
- Validação de entrada via DTO
- Tratamento de erros padronizado
- Retorno sempre como objeto Output

### 📋 **Exemplos de Uso**

#### Request:
```bash
PUT /api/v1/profiles/abc123/password
Content-Type: application/json

{
  "password": "novaSenha123"
}
```

#### Response Success (200):
```json
{
  "isValid": true,
  "successMessages": ["Password updated successfully"],
  "errorMessages": [],
  "result": "Password updated successfully"
}
```

#### Response Error (400):
```json
{
  "isValid": false,
  "successMessages": [],
  "errorMessages": ["Password must contain at least one letter and one number"],
  "result": null
}
```

#### Response Error (404):
```json
{
  "isValid": false,
  "successMessages": [],
  "errorMessages": ["Profile not found"],
  "result": null
}
```

### 🔒 **Validações Implementadas**

#### Validações de Entrada:
- `supabaseId` obrigatório
- `password` obrigatório e string
- Perfil deve existir no banco

#### Validações de Senha:
- **Tamanho**: 6-50 caracteres
- **Formato**: Pelo menos 1 letra maiúscula + 1 número + 1 caractere especial
- **Caracteres Especiais**: `!@#$%^&*()_+-=[]{};':"\\|,.<>/?`
- **Exemplo Válido**: `MinhaSenh@123`

### 🎯 **Características Especiais**

#### 1. **Atualização Única no Auth**
- Diferente do endpoint de profile que atualiza Auth + Database
- Senha é atualizada **apenas no Supabase Auth**
- Não há dados de senha armazenados na tabela Profile

#### 2. **Resposta Simplificada**
- Retorna apenas mensagem de sucesso
- Não retorna dados do perfil
- Focado na confirmação da operação

#### 3. **Consistência com Padrão Output**
- Todas as respostas seguem padrão Output
- Erros sempre com `isValid: false`
- Sucessos sempre com `isValid: true`

### 🚦 **Status HTTP Retornados**
- **200**: Senha atualizada com sucesso
- **400**: Dados inválidos, validação falhou
- **404**: Profile não encontrado
- **500**: Erro interno do servidor

### ✅ **Verificação de Funcionamento**
- ✅ Build executado com sucesso
- ✅ TypeScript compilado sem erros
- ✅ Rota criada e reconhecida pelo Next.js
- ✅ Padrão de arquitetura limpa mantido
- ✅ Validações robustas implementadas

**Status**: 🚀 **IMPLEMENTAÇÃO COMPLETA E FUNCIONAL**