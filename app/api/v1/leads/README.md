# 📋 Lead CRUD API Documentation

Este documento descreve o sistema completo de CRUD (Create, Read, Update, Delete) para gerenciamento de leads no Lead Flow.

## 🏗️ Arquitetura

O sistema segue uma arquitetura em camadas:

```
├── DTOs/                   # Data Transfer Objects
├── Repositories/           # Camada de acesso a dados
├── Use Cases/             # Lógica de negócio
├── API Routes/            # Endpoints HTTP
└── React Hooks/           # Interface React
```

## 📊 Modelo de Dados

### Lead Entity
```typescript
interface Lead {
  id: string;                    // UUID único
  managerId: string;             // ID do manager responsável
  assignedTo?: string;           // ID do operador atribuído
  status: LeadStatus;            // Status atual do lead
  name: string;                  // Nome do lead
  email?: string;                // Email de contato
  phone?: string;                // Telefone de contato
  cnpj?: string;                 // CNPJ (para empresas)
  age?: number;                  // Idade
  hasHealthPlan?: boolean;       // Possui plano de saúde
  currentValue?: number;         // Valor atual do plano
  referenceHospital?: string;    // Hospital de referência
  currentTreatment?: string;     // Tratamento atual
  meetingDate?: Date;            // Data da reunião
  notes?: string;                // Observações
  createdAt: Date;               // Data de criação
  updatedAt: Date;               // Data de atualização
}
```

### Status do Lead
```typescript
enum LeadStatus {
  new_opportunity = "new_opportunity",     // Nova oportunidade
  scheduled = "scheduled",                 // Agendado
  no_show = "no_show",                    // Não compareceu
  pricingRequest = "pricingRequest",       // Solicitação de preço
  offerNegotiation = "offerNegotiation",   // Negociação de proposta
  pending_documents = "pending_documents", // Documentos pendentes
  offerSubmission = "offerSubmission",     // Envio de proposta
  dps_agreement = "dps_agreement",         // Acordo DPS
  invoicePayment = "invoicePayment",       // Pagamento de boleto
  disqualified = "disqualified",           // Desqualificado
  opportunityLost = "opportunityLost",     // Oportunidade perdida
  operator_denied = "operator_denied",     // Negado pela operadora
  contract_finalized = "contract_finalized" // Contrato finalizado
}
```

## 🔌 API Endpoints

### Base URL: `/api/v1/leads`

#### 1. Criar Lead
```http
POST /api/v1/leads
Content-Type: application/json
```

**Body:**
```json
{
  "name": "João da Silva",
  "email": "joao@email.com",
  "phone": "(11) 99999-9999",
  "age": 35,
  "hasHealthPlan": false,
  "notes": "Interessado em plano familiar"
}
```

**Response:**
```json
{
  "success": true,
  "lead": { /* LeadResponseDTO */ },
  "message": "Lead criado com sucesso"
}
```

#### 2. Listar Leads
```http
GET /api/v1/leads?status=new_opportunity&page=1&limit=10
```

**Query Parameters:**
- `status` (opcional): Filtrar por status
- `assignedTo` (opcional): Filtrar por operador atribuído
- `page` (opcional): Página atual (padrão: 1)
- `limit` (opcional): Itens por página (padrão: 10)
- `search` (opcional): Buscar por nome, email ou telefone
- `startDate` (opcional): Data inicial (ISO string)
- `endDate` (opcional): Data final (ISO string)

**Response:**
```json
{
  "leads": [ /* Array de LeadResponseDTO */ ],
  "total": 50,
  "page": 1,
  "limit": 10,
  "totalPages": 5
}
```

#### 3. Buscar Lead por ID
```http
GET /api/v1/leads/{id}
```

**Response:**
```json
{
  "id": "uuid",
  "managerId": "uuid",
  "name": "João da Silva",
  "status": "new_opportunity",
  "manager": {
    "id": "uuid",
    "fullName": "Manager Name",
    "email": "manager@email.com"
  },
  "activities": [ /* Array de atividades */ ]
}
```

#### 4. Atualizar Lead
```http
PUT /api/v1/leads/{id}
Content-Type: application/json
```

**Body:**
```json
{
  "name": "João da Silva Santos",
  "status": "scheduled",
  "meetingDate": "2025-09-20T10:00:00Z"
}
```

#### 5. Excluir Lead
```http
DELETE /api/v1/leads/{id}
```

#### 6. Atualizar Status
```http
PATCH /api/v1/leads/{id}/status
Content-Type: application/json
```

**Body:**
```json
{
  "status": "scheduled"
}
```

#### 7. Atribuir a Operador
```http
PATCH /api/v1/leads/{id}/assign
Content-Type: application/json
```

**Body:**
```json
{
  "operatorId": "uuid-do-operador"
}
```

## ⚛️ React Hooks

### useLeads Hook

```typescript
import { useLeads } from '@/hooks/useLeads';

function LeadsList() {
  const {
    leads,
    loading,
    error,
    total,
    fetchLeads,
    createLead,
    updateLead,
    deleteLead,
    updateLeadStatus
  } = useLeads({
    status: LeadStatus.new_opportunity,
    page: 1,
    limit: 10
  });

  // Carregar leads
  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Criar novo lead
  const handleCreate = async (data) => {
    try {
      await createLead(data);
      // Lead criado e lista atualizada automaticamente
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  // Atualizar status
  const handleStatusChange = async (id, status) => {
    try {
      await updateLeadStatus(id, status);
      // Status atualizado e lista atualizada automaticamente
    } catch (error) {
      console.error('Erro:', error);
    }
  };
}
```

### useLead Hook (Lead Individual)

```typescript
import { useLead } from '@/hooks/useLeads';

function LeadDetail({ id }) {
  const { lead, loading, error, fetchLead } = useLead(id);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  if (loading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {error}</div>;
  if (!lead) return <div>Lead não encontrado</div>;

  return (
    <div>
      <h1>{lead.name}</h1>
      <p>Status: {lead.status}</p>
      {/* Mais detalhes do lead */}
    </div>
  );
}
```

## 🔐 Autenticação e Autorização

- Todas as rotas requerem autenticação via Supabase Auth
- Leads são filtrados por `managerId` (tenant isolation)
- Operadores só veem leads atribuídos a eles
- Managers veem todos os leads de sua equipe

## 🏷️ Validação de Dados

Utiliza **Zod** para validação de schemas:

```typescript
// Validação na criação
const CreateLeadRequestSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email().optional(),
  phone: z.string().min(10).optional(),
  // ... outros campos
});
```

## 📝 Logs e Atividades

- Toda criação de lead gera uma atividade automática
- Mudanças de status podem ser logadas
- Histórico completo de atividades por lead

## 🚀 Exemplo de Integração com Kanban

```typescript
// No componente Kanban
const { leads, updateLeadStatus } = useLeads();

const handleDragEnd = async (result) => {
  const { draggableId, destination } = result;
  const newStatus = destination.droppableId as LeadStatus;
  
  try {
    await updateLeadStatus(draggableId, newStatus);
    // Lista atualizada automaticamente
  } catch (error) {
    console.error('Erro ao mover lead:', error);
  }
};
```

## 🔧 Configuração

1. **Banco de Dados**: Execute as migrações do Prisma
2. **Supabase**: Configure as variáveis de ambiente
3. **Hooks**: Importe e use nos componentes React

## 📈 Performance

- **Paginação**: Implementada em todas as listagens
- **Filtros**: Suporte a múltiplos filtros simultâneos
- **Cache**: Hooks mantêm estado local para performance
- **Lazy Loading**: Carregamento sob demanda

## 🧪 Testes

```bash
# Testar endpoints
npm run test:api

# Testar hooks
npm run test:hooks
```

---

Este CRUD fornece uma base sólida e escalável para o gerenciamento de leads no Lead Flow! 🚀