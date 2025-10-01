# Atualização das Métricas do Dashboard - Uso de Tabelas Específicas

## Resumo das Mudanças

As métricas do dashboard foram atualizadas para buscar dados das tabelas específicas:

### 1. **Agendamentos** 
- **Antes**: Contava leads com status `scheduled` da tabela `leads`
- **Depois**: Busca da tabela `LeadsSchedule`
- **Motivo**: A tabela `LeadsSchedule` contém o histórico completo de agendamentos, incluindo data e notas

### 2. **Vendas**
- **Antes**: Contava leads com status `contract_finalized` da tabela `leads`
- **Depois**: Busca da tabela `LeadFinalized`
- **Motivo**: A tabela `LeadFinalized` contém informações detalhadas das vendas (valor, data de finalização, notas)

### 3. **Receita Total**
- **Antes**: Somava `currentValue` dos leads com status `contract_finalized`
- **Depois**: Soma o campo `amount` da tabela `LeadFinalized`
- **Motivo**: Valor mais preciso da venda finalizada

## Arquivos Modificados

### 1. `app/api/infra/data/repositories/metrics/IMetricsRepository.ts`
**Mudanças:**
- Adicionado interface `ScheduleMetricsData` para dados de agendamento
- Adicionado interface `SaleMetricsData` para dados de vendas
- Adicionado método `getScheduledLeads()` ao contrato
- Adicionado método `getFinalizedLeads()` ao contrato

### 2. `app/api/infra/data/repositories/metrics/MetricsRepository.ts`
**Mudanças:**
- Implementado método `getScheduledLeads()`:
  - Busca agendamentos da tabela `LeadsSchedule`
  - Respeita permissões (Manager vs Operator)
  - Aplica filtros de data
  
- Implementado método `getFinalizedLeads()`:
  - Busca vendas da tabela `LeadFinalized`
  - Respeita permissões (Manager vs Operator)
  - Aplica filtros de data

### 3. `app/api/services/DashboardInfosService.ts`
**Mudanças no método `getDashboardMetrics()`:**
- Chama `getScheduledLeads()` para contar agendamentos
- Chama `getFinalizedLeads()` para contar vendas
- Calcula `receitaTotal` usando o campo `amount` da tabela `LeadFinalized`
- Mantém cálculo das outras métricas (negociação, implementação, churn, NoShow) baseado no status dos leads

## Impacto

### Métricas Afetadas:
1. **agendamentos**: Agora reflete registros na tabela `LeadsSchedule`
2. **vendas**: Agora reflete registros na tabela `LeadFinalized`
3. **receitaTotal**: Agora usa valores da coluna `amount` em `LeadFinalized`
4. **taxaConversao**: Recalculada com base nos novos valores
5. **churnRate**: Recalculada com base no novo valor de vendas

### Métricas Não Afetadas:
- **negociacao**: Ainda baseada nos status `offerNegotiation` e `pricingRequest`
- **implementacao**: Ainda baseada nos status `offerSubmission`, `dps_agreement`, `invoicePayment`, `pending_documents`
- **NoShow**: Ainda baseada no status `no_show`
- **churn**: Ainda baseada no status `operator_denied`

## Benefícios

1. **Dados mais precisos**: Agendamentos e vendas agora vêm de tabelas especializadas
2. **Histórico completo**: As tabelas `LeadsSchedule` e `LeadFinalized` mantêm histórico
3. **Valores corretos**: Receita total usa valores finalizados reais
4. **Separação de responsabilidades**: Cada tabela tem seu propósito específico

## Compatibilidade

- ✅ Mantém permissões (Manager/Operator)
- ✅ Mantém filtros de data
- ✅ Mantém estrutura de retorno da API
- ✅ Não quebra o frontend existente

## Próximos Passos Recomendados

1. **Testes**: Validar as métricas com dados reais
2. **Documentação**: Atualizar documentação da API se necessário
3. **Migration**: Garantir que dados existentes sejam migrados para as novas tabelas
4. **Seed**: Atualizar scripts de seed para popular as novas tabelas
