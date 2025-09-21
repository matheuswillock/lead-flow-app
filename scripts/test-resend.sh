#!/bin/bash

# Script para testar a integração com Resend
# Execute: bash test-resend.sh

echo "🚀 Testando integração Resend no Lead Flow App"
echo "============================================="

# URL base da aplicação
BASE_URL="http://localhost:3000"

echo ""
echo "1. 📋 Verificando exemplos disponíveis..."
curl -s "$BASE_URL/api/email/send" | jq '.'

echo ""
echo "2. 📧 Testando email personalizado..."
curl -X POST "$BASE_URL/api/email/send" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "custom",
    "to": ["teste@exemplo.com"],
    "subject": "Teste Lead Flow - Resend",
    "html": "<h1>🎉 Resend funcionando!</h1><p>Este é um email de teste do Lead Flow.</p>",
    "text": "Resend funcionando! Este é um email de teste do Lead Flow."
  }' | jq '.'

echo ""
echo "3. 👋 Testando email de boas-vindas..."
curl -X POST "$BASE_URL/api/email/send" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "welcome",
    "userName": "João Teste",
    "userEmail": "joao.teste@exemplo.com",
    "loginUrl": "http://localhost:3000/sign-in"
  }' | jq '.'

echo ""
echo "4. 🎯 Testando notificação de lead..."
curl -X POST "$BASE_URL/api/email/send" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "lead-notification",
    "leadName": "Maria Silva",
    "leadEmail": "maria.silva@exemplo.com",
    "leadPhone": "(11) 99999-9999",
    "managerName": "João Manager",
    "managerEmail": "joao.manager@exemplo.com"
  }' | jq '.'

echo ""
echo "✅ Testes concluídos!"
echo ""
echo "📝 Para usar em produção:"
echo "1. Configure RESEND_API_KEY no .env.local"
echo "2. Verifique domínio no Resend Dashboard"
echo "3. Altere emails de teste para emails reais"
echo ""
echo "📚 Documentação: docs/RESEND_INTEGRATION.md"