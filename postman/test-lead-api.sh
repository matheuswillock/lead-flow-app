#!/bin/bash

# Script para testar a API de Leads usando curl
# Execute: chmod +x test-lead-api.sh && ./test-lead-api.sh

# Configurações
BASE_URL="http://localhost:3000"
SUPABASE_USER_ID="your-supabase-user-id-here"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Testando API de Leads${NC}"
echo "======================================"

# Função para fazer requisições
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo -e "\n${YELLOW}📋 $description${NC}"
    echo "Endpoint: $method $endpoint"
    
    if [ -z "$data" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
            -X $method \
            -H "Content-Type: application/json" \
            -H "x-supabase-user-id: $SUPABASE_USER_ID" \
            "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
            -X $method \
            -H "Content-Type: application/json" \
            -H "x-supabase-user-id: $SUPABASE_USER_ID" \
            -d "$data" \
            "$BASE_URL$endpoint")
    fi
    
    http_code=$(echo $response | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    body=$(echo $response | sed -e 's/HTTPSTATUS\:.*//g')
    
    if [ $http_code -ge 200 ] && [ $http_code -lt 300 ]; then
        echo -e "${GREEN}✅ Status: $http_code${NC}"
    else
        echo -e "${RED}❌ Status: $http_code${NC}"
    fi
    
    echo "Response: $body" | jq '.' 2>/dev/null || echo "Response: $body"
    
    # Extrair leadId se for criação bem-sucedida
    if [ $http_code -eq 201 ] && [[ $endpoint == *"/leads" ]]; then
        LEAD_ID=$(echo $body | jq -r '.result.id' 2>/dev/null)
        if [ "$LEAD_ID" != "null" ] && [ -n "$LEAD_ID" ]; then
            echo -e "${GREEN}💾 Lead ID salvo: $LEAD_ID${NC}"
        fi
    fi
}

# Verificar se jq está instalado
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠️  jq não encontrado. Instalando...${NC}"
    # Para Ubuntu/Debian
    sudo apt-get update && sudo apt-get install -y jq 2>/dev/null || \
    # Para MacOS
    brew install jq 2>/dev/null || \
    echo -e "${RED}❌ Não foi possível instalar jq. JSON não será formatado.${NC}"
fi

# Verificar se o servidor está rodando
echo -e "\n${YELLOW}🔍 Verificando se o servidor está rodando...${NC}"
if curl -s "$BASE_URL" > /dev/null; then
    echo -e "${GREEN}✅ Servidor rodando em $BASE_URL${NC}"
else
    echo -e "${RED}❌ Servidor não está rodando em $BASE_URL${NC}"
    echo "Execute: bun run dev"
    exit 1
fi

# Verificar se o SUPABASE_USER_ID foi configurado
if [ "$SUPABASE_USER_ID" = "your-supabase-user-id-here" ]; then
    echo -e "${RED}❌ Configure o SUPABASE_USER_ID no script antes de executar${NC}"
    exit 1
fi

# 1. Criar Lead
CREATE_DATA='{
  "name": "João Silva",
  "email": "joao.silva@email.com",
  "phone": "(11) 99999-9999",
  "cnpj": "12.345.678/0001-90",
  "age": 45,
  "hasHealthPlan": true,
  "currentValue": 2500.00,
  "referenceHospital": "Hospital São Paulo",
  "currentTreatment": "Cardiologia",
  "notes": "Cliente interessado em plano familiar",
  "status": "new_opportunity"
}'

make_request "POST" "/api/v1/leads" "$CREATE_DATA" "1. Criar Lead"

# Aguardar um pouco para garantir que o lead foi criado
sleep 1

# 2. Listar Leads
make_request "GET" "/api/v1/leads?page=1&limit=10" "" "2. Listar Leads"

# 3. Buscar Lead por ID (se tivermos um ID)
if [ -n "$LEAD_ID" ]; then
    make_request "GET" "/api/v1/leads/$LEAD_ID" "" "3. Buscar Lead por ID"
    
    # 4. Atualizar Lead
    UPDATE_DATA='{
      "name": "João Silva Santos",
      "email": "joao.santos@email.com",
      "currentValue": 3000.00,
      "notes": "Cliente atualizado - interessado em plano premium"
    }'
    
    make_request "PUT" "/api/v1/leads/$LEAD_ID" "$UPDATE_DATA" "4. Atualizar Lead"
    
    # 5. Atualizar Status
    STATUS_DATA='{"status": "scheduled"}'
    make_request "PATCH" "/api/v1/leads/$LEAD_ID/status" "$STATUS_DATA" "5. Atualizar Status"
    
    # 6. Excluir Lead
    make_request "DELETE" "/api/v1/leads/$LEAD_ID" "" "6. Excluir Lead"
else
    echo -e "${RED}❌ Não foi possível obter Lead ID. Pulando testes que dependem do ID.${NC}"
fi

# 7. Teste de erro - Lead não encontrado
make_request "GET" "/api/v1/leads/lead-inexistente" "" "7. Teste de Erro - Lead Não Encontrado"

# 8. Teste de erro - Sem autenticação
echo -e "\n${YELLOW}📋 8. Teste de Erro - Sem Autenticação${NC}"
echo "Endpoint: GET /api/v1/leads"

response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
    -X GET \
    -H "Content-Type: application/json" \
    "$BASE_URL/api/v1/leads")

http_code=$(echo $response | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
body=$(echo $response | sed -e 's/HTTPSTATUS\:.*//g')

if [ $http_code -eq 401 ]; then
    echo -e "${GREEN}✅ Status: $http_code (esperado)${NC}"
else
    echo -e "${RED}❌ Status: $http_code (esperado 401)${NC}"
fi

echo "Response: $body" | jq '.' 2>/dev/null || echo "Response: $body"

echo -e "\n${GREEN}🎉 Testes concluídos!${NC}"
echo "======================================"