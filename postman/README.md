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

### 3. Profile API Collection ⭐ **NOVO**
**Arquivo**: `Profile-API-Collection.json`
**Descrição**: Endpoints para gerenciamento de profiles de usuários (CRUD completo)

**Endpoints incluídos**:
- ✅ Registrar Novo Profile
- ✅ Buscar Profile por Supabase ID
- ✅ Atualizar Profile (Nome, Telefone, Email)
- ✅ Atualizar Senha
- ✅ Deletar Profile
- ✅ Verificação de Profile Deletado
- ✅ Testes de Erro (Email duplicado, Senha fraca, Profile inexistente, Dados inválidos)

## Environment

**Arquivo**: `Lead-Flow-Environment.json`
**Descrição**: Variáveis de ambiente para todas as coleções

**Variáveis configuradas**:
- `baseUrl`: http://localhost:3000
- `supabaseUserId`: ed4ab5a4-3188-41fa-8389-481784cb1f84
- `leadId`: (preenchido automaticamente)
- `operatorId`: (preenchido automaticamente)
- `managerId`: (preenchido automaticamente)

## � Profile API Collection

A coleção **Profile-API-Collection.json** contém 14 requests para testar todos os endpoints da API de Profiles:

### ✅ Testes de Sucesso
- Register New Profile: Criação de profile com dados válidos
- Get Profile by ID: Busca profile existente
- Update Profile Fields: Atualização parcial de campos
- Change Password: Alteração de senha com validação
- Delete Profile: Remoção de profile existente

### ❌ Testes de Erro
- Register with Duplicate Email: Teste de email já existente
- Register with Weak Password: Teste de senha fraca
- Register with Invalid Data: Teste de dados malformados
- Get Non-existent Profile: Busca profile inexistente
- Update Non-existent Profile: Atualização de profile inexistente
- Update with Invalid Data: Dados inválidos na atualização
- Change Password Non-existent: Alteração em profile inexistente
- Change Password Weak: Teste de senha fraca
- Delete Non-existent Profile: Remoção de profile inexistente

### Variáveis Utilizadas
   - `leadEmail`: Email para testes de lead
   - `leadPhone`: Telefone para testes de lead
   - `managerEmail`: Email do gerente para testes
   - `operatorEmail`: Email do operador para testes
   - `managerId`: ID do gerente no Supabase
   - `profileEmail`: Email para testes de profile ⭐ **NOVO**
   - `newUserSupabaseId`: ID do Supabase para o novo usuário ⭐ **NOVO**
- `newUserSupabaseId`: ID do Supabase para o novo usuário
- Variáveis automáticas salvam: `profileId`, `authToken`

---

## 🧪 Como Executar os Testes

### 1. Importar no Postman

1. Abra o Postman
2. Clique em "Import"
3. Selecione os arquivos:
   - `Lead-Flow-Environment.json` (Environment)
   - `Lead-API-Collection.json` (Coleção de Leads)
   - `Manager-User-API-Collection.json` (Coleção de Usuários) ⭐ **NOVO**
   - `Profile-API-Collection.json` (Coleção de Profiles) ⭐ **NOVO**

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

#### 🔍 Para API de Leads:
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

#### 👥 Para API de Profiles:
Execute na ordem para testar o fluxo completo:

1. **Register New Profile** - Cria um novo profile (salva automaticamente `profileId`)
2. **Get Profile by ID** - Busca o profile criado
3. **Update Profile Fields** - Atualiza campos do profile
4. **Change Password** - Altera a senha do profile
5. **Delete Profile** - Remove o profile

Para testar cenários de erro, execute os testes de erro de cada endpoint para verificar as mensagens apropriadas e status codes corretos (400, 404, etc.).

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