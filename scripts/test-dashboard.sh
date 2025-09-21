#!/bin/bash

# Script para testar a API do Dashboard
# Certificar-se de que o servidor está rodando na porta 3000

echo "🚀 Testando API do Dashboard..."
echo ""

# URL base (ajustar conforme necessário)
BASE_URL="http://localhost:3000"

# ID de teste (substitua por um supabaseId válido do seu banco)
SUPABASE_ID="your-test-supabase-id"

# Testar endpoint de métricas do dashboard
echo "📊 Testando endpoint de métricas..."
echo "GET $BASE_URL/api/v1/dashboard/$SUPABASE_ID/metrics"
echo ""

response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
  -H "Content-Type: application/json" \
  "$BASE_URL/api/v1/dashboard/$SUPABASE_ID/metrics")

# Extrair o status HTTP
http_code=$(echo $response | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
# Extrair o corpo da resposta
response_body=$(echo $response | sed -e 's/HTTPSTATUS\:.*//g')

echo "Status HTTP: $http_code"
echo ""

if [ $http_code -eq 200 ]; then
    echo "✅ Sucesso! Dados recebidos:"
    echo $response_body | jq '.' 2>/dev/null || echo $response_body
else
    echo "❌ Erro na requisição:"
    echo $response_body
fi

echo ""
echo "📝 Para testar com um supabaseId real:"
echo "1. Substitua 'your-test-supabase-id' por um ID válido"
echo "2. Certifique-se de que o servidor Next.js está rodando"
echo "3. Execute novamente: ./scripts/test-dashboard.sh"