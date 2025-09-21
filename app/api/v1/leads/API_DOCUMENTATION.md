# API Documentation - GET /api/v1/leads

## Descrição
A rota GET agora foi modificada para retornar todos os leads (sem paginação) baseado no role do usuário.

## Parâmetros Obrigatórios

### Headers
- `x-supabase-user-id`: ID do usuário no Supabase

### Query Parameters
- `role`: Role do usuário ("manager" ou "operator")

## Parâmetros Opcionais

### Query Parameters
- `status`: Status do lead (LeadStatus enum)
- `assignedTo`: ID do operador para filtrar leads atribuídos
- `search`: Termo de busca (nome, email ou telefone)
- `startDate`: Data inicial para filtro (formato: YYYY-MM-DD)
- `endDate`: Data final para filtro (formato: YYYY-MM-DD)

## Comportamento por Role

### Manager (`role=manager`)
- Retorna **todos os leads** do manager, incluindo:
  - Leads não atribuídos
  - Leads atribuídos aos operators sob sua gestão
- Pode filtrar por `assignedTo` para ver leads de um operator específico

### Operator (`role=operator`)
- Retorna **apenas os leads atribuídos** ao operator
- Não pode ver leads de outros operators
- O parâmetro `assignedTo` é ignorado (sempre filtra pelo próprio ID)

## Exemplos de Uso

### Manager visualizando todos os leads
```
GET /api/v1/leads?role=manager
Headers: x-supabase-user-id: abc123
```

### Manager filtrando por status
```
GET /api/v1/leads?role=manager&status=new_opportunity
Headers: x-supabase-user-id: abc123
```

### Manager visualizando leads de um operator específico
```
GET /api/v1/leads?role=manager&assignedTo=operator456
Headers: x-supabase-user-id: abc123
```

### Operator visualizando seus leads
```
GET /api/v1/leads?role=operator
Headers: x-supabase-user-id: operator456
```

### Operator filtrando por status e busca
```
GET /api/v1/leads?role=operator&status=scheduled&search=João
Headers: x-supabase-user-id: operator456
```

## Resposta
```json
{
  "isValid": true,
  "messages": [],
  "errors": [],
  "data": [
    {
      "id": "lead_id",
      "managerId": "manager_id",
      "assignedTo": "operator_id",
      "status": "new_opportunity",
      "name": "João Silva",
      "email": "joao@example.com",
      "phone": "+5511999999999",
      "cnpj": "12345678000100",
      "age": 35,
      "hasHealthPlan": true,
      "currentValue": 500.00,
      "referenceHospital": "Hospital ABC",
      "currentTreatment": "Tratamento cardiológico",
      "meetingDate": "2025-09-20T10:00:00.000Z",
      "notes": "Lead interessado em plano familiar",
      "createdAt": "2025-09-18T14:30:00.000Z",
      "updatedAt": "2025-09-18T14:30:00.000Z",
      "manager": {
        "id": "manager_id",
        "fullName": "Maria Manager",
        "email": "maria@company.com"
      },
      "assignee": {
        "id": "operator_id", 
        "fullName": "Carlos Operator",
        "email": "carlos@company.com"
      }
    }
  ]
}
```

## Principais Mudanças

1. ✅ **Removida paginação**: Agora retorna todos os leads de uma vez
2. ✅ **Adicionado parâmetro `role`**: Obrigatório para determinar permissões
3. ✅ **Lógica de permissões**: Manager vê todos, Operator vê apenas os seus
4. ✅ **Novos métodos no repositório**: `findAllByManagerId` e `findAllByOperatorId`
5. ✅ **Novo método no UseCase**: `getAllLeadsByUserRole`

## Códigos de Erro

- `400`: Role inválido ou ausente
- `401`: x-supabase-user-id ausente
- `404`: Perfil do usuário não encontrado
- `403`: Operador tentando acessar leads de outros (implícito na lógica)
- `500`: Erro interno do servidor