# Manager User API Endpoints

Este documento descreve os endpoints da API para gerenciamento de usuários (Manager/Operator).

## Base URL
```
/api/v1/manager/[supabaseId]/users
```

## Autenticação
Todos os endpoints requerem:
- Header `x-supabase-user-id` com o ID do usuário autenticado
- O usuário deve ter role `manager`
- O `supabaseId` na URL deve corresponder ao usuário autenticado

## Endpoints

### 1. Criar Usuário (Manager/Operator)
**POST** `/api/v1/manager/[supabaseId]/users`

**Request Body:**
```json
{
  "name": "Nome do Usuário",
  "email": "email@exemplo.com",
  "role": "manager" | "operator",
  "profileIconUrl": "https://exemplo.com/avatar.jpg" // opcional
}
```

**Response:**
```json
{
  "isValid": true,
  "successMessages": ["Manager criado com sucesso"],
  "errorMessages": [],
  "result": {
    "id": "uuid",
    "name": "Nome do Usuário",
    "email": "email@exemplo.com",
    "role": "manager",
    "profileIconUrl": "https://exemplo.com/avatar.jpg",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

### 2. Listar Usuários
**GET** `/api/v1/manager/[supabaseId]/users?role=manager|operator`

**Query Parameters:**
- `role` (opcional): Filtra por role específico

**Response:**
```json
{
  "isValid": true,
  "successMessages": [],
  "errorMessages": [],
  "result": [
    {
      "id": "uuid",
      "name": "Nome do Usuário",
      "email": "email@exemplo.com",
      "role": "manager",
      "profileIconUrl": "https://exemplo.com/avatar.jpg",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

### 3. Associar/Dissociar Operator
**PUT** `/api/v1/manager/[supabaseId]/users`

**Para Associar:**
```json
{
  "action": "associate",
  "managerId": "uuid-do-manager",
  "operatorId": "uuid-do-operator"
}
```

**Para Dissociar:**
```json
{
  "action": "dissociate",
  "operatorId": "uuid-do-operator"
}
```

**Response:**
```json
{
  "isValid": true,
  "successMessages": ["Operator associado ao manager com sucesso"],
  "errorMessages": [],
  "result": null
}
```

### 4. Deletar Usuário
**DELETE** `/api/v1/manager/[supabaseId]/users?userId=uuid`

**Query Parameters:**
- `userId`: ID do usuário a ser deletado

**Response:**
```json
{
  "isValid": true,
  "successMessages": ["Usuário removido com sucesso"],
  "errorMessages": [],
  "result": null
}
```

## Códigos de Status

- **200**: Sucesso
- **400**: Dados inválidos ou erro de validação
- **401**: Header de autenticação ausente
- **403**: Acesso negado (usuário não é manager ou tentando acessar recursos de outro usuário)
- **500**: Erro interno do servidor

## Validações de Business Rules

### Criação de Usuário:
- Nome deve ter pelo menos 2 caracteres
- Email deve ser válido e único
- Role deve ser 'manager' ou 'operator'

### Associação de Operator:
- Manager e Operator devem existir
- Operator não pode estar associado a outro manager
- Manager só pode associar operators a si mesmo

### Deleção:
- Manager não pode deletar a si mesmo
- Verificações de dependência (operators associados, leads atribuídos)

## Exemplos de Erro

### Email Duplicado:
```json
{
  "isValid": false,
  "successMessages": [],
  "errorMessages": ["Email já está em uso"],
  "result": null
}
```

### Acesso Negado:
```json
{
  "isValid": false,
  "successMessages": [],
  "errorMessages": ["Acesso negado. Apenas managers podem realizar esta operação"],
  "result": null
}
```