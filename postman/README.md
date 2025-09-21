# Postman Collections - Lead Flow App

Este diretório contém as coleções do Postman para testar os endpoints da API do Lead Flow App.

## Coleções Disponíveis

### 1. Lead API Collection
**Arquivo**: `Lead-API-Collection.json`
**Descrição**: Endpoints para gerenciamento de leads (CRUD completo)

**Endpoints incluídos**:
- ✅ Criar Lead
- ✅ Listar Leads (com paginação)
- ✅ Buscar Lead por ID
- ✅ Atualizar Lead
- ✅ Deletar Lead
- ✅ Atribuir Lead a Operador
- ✅ Desatribuir Lead

### 2. Manager User API Collection ⭐ **NOVO**
**Arquivo**: `Manager-User-API-Collection.json`
**Descrição**: Endpoints para gerenciamento de usuários (Manager/Operator)

**Endpoints incluídos**:
- ✅ Criar Manager
- ✅ Criar Operator
- ✅ Listar Todos os Usuários
- ✅ Listar Apenas Managers
- ✅ Listar Apenas Operators
- ✅ Associar Operator ao Manager
- ✅ Dissociar Operator do Manager
- ✅ Deletar Operator
- ✅ Deletar Manager
- ✅ Testes de Erro (Email duplicado, Acesso não autorizado, Dados inválidos)

## Environment

**Arquivo**: `Lead-Flow-Environment.json`
**Descrição**: Variáveis de ambiente para todas as coleções

**Variáveis configuradas**:
- `baseUrl`: http://localhost:3000
- `supabaseUserId`: ed4ab5a4-3188-41fa-8389-481784cb1f84
- `leadId`: (preenchido automaticamente)
- `operatorId`: (preenchido automaticamente)
- `managerId`: (preenchido automaticamente)

## 🚀 Como Usar

### 1. Importar no Postman

1. Abra o Postman
2. Clique em **Import**
3. Selecione o arquivo `Lead-API-Collection.json`
4. Importe também o environment `Lead-Flow-Environment.json`

### 2. Configurar Environment

1. Selecione o environment **"Lead Flow App - Development"**
2. Edite as seguintes variáveis:
   - `baseUrl`: URL da sua aplicação (padrão: http://localhost:3000)
   - `supabaseUserId`: ID real de um usuário autenticado no Supabase
   - `operatorId`: ID de um operador válido para testes de atribuição

### 3. Obter o supabaseUserId

Para obter um `supabaseUserId` válido:

1. Acesse sua aplicação no navegador
2. Faça login
3. Abra o DevTools (F12)
4. Vá para **Application > Local Storage**
5. Procure por chaves relacionadas ao Supabase
6. Ou use o console e execute:
   ```javascript
   // Se estiver usando o Supabase client no frontend
   supabase.auth.getUser().then(({data}) => console.log(data.user.id))
   ```

### 4. Executar os Testes

Execute as requisições na ordem para testar o fluxo completo:

1. **Criar Lead** - Cria um novo lead e salva o ID
2. **Listar Leads** - Lista todos os leads
3. **Buscar Lead por ID** - Busca o lead criado
4. **Atualizar Lead** - Atualiza dados do lead
5. **Atualizar Status** - Muda o status do lead
6. **Atribuir Lead** - Atribui lead a um operador
7. **Listar com Filtros** - Testa filtros de busca
8. **Excluir Lead** - Remove o lead
9. **Teste de Erro - 404** - Testa lead inexistente
10. **Teste de Erro - 401** - Testa sem autenticação

## 📊 Estrutura das Respostas

Todas as rotas seguem o padrão **Output**:

```json
{
  "isValid": true,
  "successMessages": ["Mensagem de sucesso"],
  "errorMessages": [],
  "result": { /* dados do resultado */ }
}
```

## 🔍 Casos de Teste Incluídos

### ✅ Testes de Sucesso
- Criação de lead com dados válidos
- Listagem com paginação
- Busca por ID
- Atualização de dados
- Mudança de status
- Atribuição a operador
- Filtros de busca
- Exclusão

### ❌ Testes de Erro
- Lead não encontrado (404)
- Requisição sem autenticação (401)
- Dados inválidos (400)
- Validação de campos obrigatórios

## 🛡️ Headers Obrigatórios

Todas as requisições precisam do header:
```
x-supabase-user-id: {seu-supabase-user-id}
```

## 📝 Status de Lead Válidos

- `new_opportunity`
- `scheduled`
- `no_show`
- `pricingRequest`
- `offerNegotiation`
- `pending_documents`
- `offerSubmission`
- `contract_analysis`
- `contract_adjustment`
- `contract_approved`
- `cold_lead`
- `lost_opportunity`
- `contract_finalized`

## 🔧 Troubleshooting

### Erro 401 - Não Autorizado
- Verifique se o header `x-supabase-user-id` está presente
- Confirme se o `supabaseUserId` é válido

### Erro 404 - Lead Não Encontrado
- Verifique se o `leadId` existe
- Execute primeiro "Criar Lead" para ter um ID válido

### Erro 400 - Dados Inválidos
- Verifique a estrutura JSON do body
- Confirme se os campos obrigatórios estão presentes
- Valide se o status é um dos valores permitidos

## 🚦 Executando Collection Completa

Para executar todos os testes de uma vez:
1. Clique nos três pontos (...) na collection
2. Selecione **"Run collection"**
3. Configure o environment
4. Execute

A collection está configurada para:
- Salvar automaticamente o `leadId` após criação
- Executar testes de validação em cada requisição
- Verificar estrutura das respostas
- Testar cenários de erro