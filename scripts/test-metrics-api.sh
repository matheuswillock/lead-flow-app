#!/bin/bash

# Script de teste para validar as métricas do dashboard
# Este script testa a API de métricas para verificar se os dados
# estão sendo buscados corretamente das tabelas LeadsSchedule e LeadFinalized

# Configuração
API_URL="${API_URL:-http://localhost:3000}"
SUPABASE_ID="${SUPABASE_ID}"

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Teste da API de Métricas do Dashboard"
echo "=========================================="
echo ""

# Verificar se SUPABASE_ID foi fornecido
if [ -z "$SUPABASE_ID" ]; then
  echo -e "${RED}❌ Erro: SUPABASE_ID não foi fornecido${NC}"
  echo "Use: SUPABASE_ID=<seu-id> ./test-metrics-api.sh"
  exit 1
fi

echo "API URL: $API_URL"
echo "Supabase ID: $SUPABASE_ID"
echo ""

# Teste 1: Buscar métricas sem filtro de data
echo -e "${YELLOW}Teste 1: Buscar métricas gerais${NC}"
echo "GET /api/v1/dashboard/metrics?supabaseId=$SUPABASE_ID"
response=$(curl -s "$API_URL/api/v1/dashboard/metrics?supabaseId=$SUPABASE_ID")

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Resposta recebida${NC}"
  echo "$response" | jq '.'
  
  # Validar estrutura da resposta
  agendamentos=$(echo "$response" | jq -r '.data.agendamentos // "null"')
  vendas=$(echo "$response" | jq -r '.data.vendas // "null"')
  receitaTotal=$(echo "$response" | jq -r '.data.receitaTotal // "null"')
  
  echo ""
  echo "Métricas Extraídas:"
  echo "  - Agendamentos (LeadsSchedule): $agendamentos"
  echo "  - Vendas (LeadFinalized): $vendas"
  echo "  - Receita Total: R$ $receitaTotal"
  
  if [ "$agendamentos" != "null" ] && [ "$vendas" != "null" ]; then
    echo -e "${GREEN}✓ Métricas válidas encontradas${NC}"
  else
    echo -e "${RED}❌ Métricas inválidas ou ausentes${NC}"
  fi
else
  echo -e "${RED}❌ Erro ao fazer requisição${NC}"
fi

echo ""
echo "=========================================="

# Teste 2: Buscar métricas com filtro de data (últimos 30 dias)
echo -e "${YELLOW}Teste 2: Buscar métricas dos últimos 30 dias${NC}"
START_DATE=$(date -u -d "30 days ago" +"%Y-%m-%dT00:00:00.000Z" 2>/dev/null || date -u -v-30d +"%Y-%m-%dT00:00:00.000Z")
END_DATE=$(date -u +"%Y-%m-%dT23:59:59.999Z")

echo "GET /api/v1/dashboard/metrics?supabaseId=$SUPABASE_ID&startDate=$START_DATE&endDate=$END_DATE"
response=$(curl -s "$API_URL/api/v1/dashboard/metrics?supabaseId=$SUPABASE_ID&startDate=$START_DATE&endDate=$END_DATE")

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Resposta recebida${NC}"
  echo "$response" | jq '.'
  
  agendamentos=$(echo "$response" | jq -r '.data.agendamentos // "null"')
  vendas=$(echo "$response" | jq -r '.data.vendas // "null"')
  
  echo ""
  echo "Métricas dos últimos 30 dias:"
  echo "  - Agendamentos: $agendamentos"
  echo "  - Vendas: $vendas"
else
  echo -e "${RED}❌ Erro ao fazer requisição${NC}"
fi

echo ""
echo "=========================================="

# Teste 3: Buscar métricas com período específico
echo -e "${YELLOW}Teste 3: Buscar métricas com período (7d)${NC}"
echo "GET /api/v1/dashboard/metrics?supabaseId=$SUPABASE_ID&period=7d"
response=$(curl -s "$API_URL/api/v1/dashboard/metrics?supabaseId=$SUPABASE_ID&period=7d")

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Resposta recebida${NC}"
  echo "$response" | jq '.'
  
  leadsPorPeriodo=$(echo "$response" | jq -r '.data.leadsPorPeriodo // []')
  echo ""
  echo "Leads por período (últimos 7 dias):"
  echo "$leadsPorPeriodo" | jq '.'
else
  echo -e "${RED}❌ Erro ao fazer requisição${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Testes concluídos!${NC}"
echo ""
echo "Nota: Verifique se:"
echo "  1. Os agendamentos estão sendo contados da tabela LeadsSchedule"
echo "  2. As vendas estão sendo contadas da tabela LeadFinalized"
echo "  3. A receita total está usando o campo 'amount' da LeadFinalized"
echo ""
