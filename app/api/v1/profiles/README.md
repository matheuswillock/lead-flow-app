# API de Profiles - Documentação

Esta API fornece operações CRUD completas para profiles de usuários, incluindo integração com autenticação Supabase.

## Padrão de Resposta

**IMPORTANTE**: Todas as rotas retornam objetos `Output` padronizados, independente do status HTTP.

### Estrutura do Output:
```json
{
  "isValid": boolean,
  "successMessages": string[],
  "errorMessages": string[],
  "result": any | null
}
```

### Status HTTP vs isValid:
- **200/201**: Sucesso - `isValid: true`
- **400/404/500**: Erro - `isValid: false`

Mesmo em casos de erro (não 200), a resposta sempre contém um objeto `Output` com `isValid: false`.

## Rotas Disponíveis

### 1. Criar Profile
**POST** `/api/v1/profiles/register`
- Cria um novo profile de usuário e conta de autenticação
- Body: `RequestToRegisterUserProfile`

**Exemplo de resposta (201):**
```json
{
  "isValid": true,
  "successMessages": ["Profile created successfully"],
  "errorMessages": [],
  "result": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "João Silva",
    "phone": "+5511999999999",
    "role": "manager",
    "supabaseId": "supabase-uuid"
  }
}
```

**Exemplo de resposta de erro (400):**
```json
{
  "isValid": false,
  "successMessages": [],
  "errorMessages": ["Email already exists"],
  "result": null
}
```

### 2. Buscar Profile por Supabase ID
**GET** `/api/v1/profiles/[supabaseId]`
- Retorna os dados do profile associado ao supabaseId
- Parâmetros: `supabaseId` (string)

**Exemplo de resposta (200):**
```json
{
  "isValid": true,
  "successMessages": ["Profile retrieved successfully"],
  "errorMessages": [],
  "result": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "João Silva",
    "phone": "+5511999999999",
    "role": "manager",
    "supabaseId": "supabase-uuid",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Exemplo de resposta de erro (404):**
```json
{
  "isValid": false,
  "successMessages": [],
  "errorMessages": ["Profile not found"],
  "result": null
}
```

### 3. Atualizar Profile

**PUT** `/api/v1/profiles/[supabaseId]`

- Atualiza os dados do profile (apenas campos permitidos)
- Parâmetros: `supabaseId` (string)
- Body: `RequestToUpdateProfile`

**Campos permitidos para atualização:**
- `fullName` (string, opcional): Nome completo do usuário
- `phone` (string, opcional): Telefone do usuário  
- `email` (string, opcional): Email do usuário

**Exemplo de body:**
```json
{
  "fullName": "João Silva Santos",
  "phone": "+5511888888888",
  "email": "joao.santos@example.com"
}
```

**Validações aplicadas:**
- `fullName`: String não vazia, máximo 100 caracteres
- `phone`: String não vazia, apenas dígitos e símbolos válidos, máximo 20 caracteres
- `email`: Email válido, máximo 254 caracteres
- Pelo menos um campo deve ser fornecido
- Apenas campos permitidos são aceitos
- Email e telefone são validados para evitar duplicatas

**Notas:**
- Atualização de email pode requerer re-autenticação
- Campos não fornecidos permanecem inalterados
- Role e outros campos administrativos não podem ser alterados via esta rota

### 4. Deletar Profile
**DELETE** `/api/v1/profiles/[supabaseId]`
- Remove o profile do banco de dados E deleta a conta de autenticação do Supabase
- Parâmetros: `supabaseId` (string)

**Exemplo de resposta:**
```json
{
  "output": {
    "isValid": true,
    "successMessages": ["Profile and authentication deleted successfully"],
    "errorMessages": [],
    "result": {
      "deletedProfile": "profile-uuid"
    }
  }
}
```

## Códigos de Status HTTP

- **200**: Operação bem-sucedida
- **400**: Dados inválidos ou erro de validação
- **404**: Profile não encontrado
- **500**: Erro interno do servidor

## Validações

### RequestToUpdateProfile
- `fullName`: String não vazia (opcional)
- `phone`: String não vazia (opcional)
- `email`: Email válido (opcional)
- Pelo menos um campo deve ser fornecido

## Segurança

- Todas as rotas requerem autenticação adequada
- Operações de delete removem dados tanto do banco quanto do Supabase Auth
- Validação de duplicatas para email e telefone

## Arquitetura

A API segue os princípios de Clean Architecture:
- **Rotas** (`route.ts`): Camada de apresentação/interface
- **Use Cases** (`ProfileUseCase.ts`): Lógica de negócio
- **Repositórios** (`ProfileRepository.ts`): Acesso a dados
- **DTOs** (`requestToUpdateProfile.ts`): Objetos de transferência de dados

## Dependências

- Prisma (banco de dados)
- Supabase (autenticação)
- Next.js App Router
- TypeScript