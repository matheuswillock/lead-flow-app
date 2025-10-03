#!/bin/bash

# 📊 Script de Teste para Dashboard API
# Execute: chmod +x test-dashboard-api.sh && ./test-dashboard-api.sh

echo "🚀 Iniciando testes da Dashboard API..."
echo "📍 Base URL: http://localhost:3000"
echo "🆔 Supabase ID: 73943504-6ccb-4c5a-9276-e830f7eae682"
echo ""

BASE_URL="http://localhost:3000"
SUPABASE_ID="73943504-6ccb-4c5a-9276-e830f7eae682"

# Função para fazer requisições e mostrar resultado
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="$3"
    
    echo "🧪 Testando: $name"
    echo "📡 URL: $url"
    
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$url")
    http_code=$(echo $response | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    body=$(echo $response | sed -e 's/HTTPSTATUS\:.*//g')
    
    if [ "$http_code" -eq "$expected_status" ]; then
        echo "✅ Status: $http_code (esperado)"
    else
        echo "❌ Status: $http_code (esperado: $expected_status)"
    fi
    
    echo "📄 Response:"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
    echo ""
    echo "=====================================\n"
}

# Teste 1: Métricas Dashboard - Período Padrão (30d)
test_endpoint \
    "Métricas Dashboard - 30 dias" \
    "$BASE_URL/api/v1/dashboard/metrics?supabaseId=$SUPABASE_ID&period=30d" \
    200

# Teste 2: Métricas Dashboard - 7 dias
test_endpoint \
    "Métricas Dashboard - 7 dias" \
    "$BASE_URL/api/v1/dashboard/metrics?supabaseId=$SUPABASE_ID&period=7d" \
    200

# Teste 3: Métricas Dashboard - Período Customizado
test_endpoint \
    "Métricas Dashboard - Período Customizado" \
    "$BASE_URL/api/v1/dashboard/metrics?supabaseId=$SUPABASE_ID&startDate=2024-01-01&endDate=2024-12-31" \
    200

# Teste 4: Métricas Dashboard - Sem supabaseId (deve dar erro)
test_endpoint \
    "Métricas Dashboard - Sem supabaseId (erro esperado)" \
    "$BASE_URL/api/v1/dashboard/metrics?period=30d" \
    400

# Teste 5: Métricas Detalhadas
test_endpoint \
    "Métricas Detalhadas por Status" \
    "$BASE_URL/api/v1/dashboard/metrics/detailed/$SUPABASE_ID" \
    200

# Teste 6: Métricas Detalhadas - supabaseId vazio (deve dar erro)
test_endpoint \
    "Métricas Detalhadas - supabaseId vazio (erro esperado)" \
    "$BASE_URL/api/v1/dashboard/metrics/detailed/" \
    404

# Teste 7: Performance - 1 ano de dados
echo "⏱️  Teste de Performance - 1 ano de dados"
start_time=$(date +%s.%N)
test_endpoint \
    "Métricas Dashboard - 1 ano (performance)" \
    "$BASE_URL/api/v1/dashboard/metrics?supabaseId=$SUPABASE_ID&period=1y" \
    200
end_time=$(date +%s.%N)
duration=$(echo "$end_time - $start_time" | bc 2>/dev/null || echo "N/A")
echo "⚡ Tempo total do teste de performance: ${duration}s"

echo ""
echo "🎉 Testes concluídos!"
echo ""
echo "📋 Como usar os endpoints:"
echo "  • Métricas Gerais: GET /api/v1/dashboard/metrics?supabaseId=UUID&period=30d"
echo "  • Métricas Detalhadas: GET /api/v1/dashboard/metrics/detailed/UUID"
echo "  • Períodos disponíveis: 7d, 30d, 3m, 6m, 1y"
echo "  • Ou use datas customizadas: startDate=YYYY-MM-DD&endDate=YYYY-MM-DD"
echo ""
echo "🔐 Lembre-se: substitua o supabaseId pelo ID real do usuário autenticado!"