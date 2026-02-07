# WhatsApp Cloud API - Configuracao e Setup

> Guia rapido para habilitar o bot WhatsApp no Lead Flow App.

## Visao Geral
A integracao WhatsApp Cloud API permite que operadores e managers consultem, criem e atualizem leads via comandos estruturados.

### Principais funcionalidades
- Consulta de leads por codigo, id, telefone ou email.
- Atualizacao de status via comando.
- Criacao de novos leads diretamente na conversa.
- Registro de atividades no historico do lead.

---

## Requisitos
- App ativo no Meta Developers.
- Produto **WhatsApp** adicionado ao app.
- Business Account configurada.
- Numero de WhatsApp Cloud habilitado.
- Token de acesso valido (preferencialmente long-lived).

---

## Variaveis de Ambiente
No servidor, configure:

```env
META_APP_SECRET=sua_app_secret_aqui
INTEGRATIONS_ENCRYPTION_KEY=sua_chave_de_criptografia
```

> Os tokens de acesso e verify token sao cadastrados na UI de Integracoes (por cliente).

---

## 1. Configurar o App no Meta Developers
1. Acesse: [developers.facebook.com](https://developers.facebook.com)
2. Crie (ou abra) o app de producao.
3. Adicione o produto **WhatsApp**.
4. Conecte uma Business Account.
5. Crie ou selecione o numero de telefone.
6. Copie os dados:
   - `phone_number_id`
   - `business_account_id`
   - `display_phone_number`

---

## 2. Gerar Token de Acesso
1. No painel do WhatsApp, gere o token.
2. Prefira token long-lived para producao.
3. Salve o token (sera usado na UI do Lead Flow).

---

## 3. Configurar Webhook do WhatsApp
### URL do Webhook
- Producao: `https://seu-dominio.com/api/webhooks/whatsapp`
- Dev: `https://seu-ngrok.ngrok-free.app/api/webhooks/whatsapp`

### Verify Token
- Defina um token seguro.
- Use o mesmo token na UI (Integracoes > WhatsApp).

### Campos
Marque os eventos de mensagens para receber conteudo de texto.

---

## 4. Configurar no Lead Flow (UI)
Acesse **Integracoes** e preencha:
- `phoneNumberId`
- `accessToken`
- `verifyToken`
- `teamId`
- `businessAccountId` (opcional)
- `businessPhoneNumber` (opcional)
- Ative a integracao

Clique em **Testar conexao** para validar token e ID.

---

## 5. Comandos do Bot
```
/ajuda
/lead <leadCode|id|telefone|email>
/status <leadCode|id> <novo_status>
/novo Nome;Telefone;Email;Cidade;Plano
/nota <leadCode|id> <texto>
```

### Exemplo
```
/novo Maria Silva;11999999999;maria@email.com;Sao Paulo;Plano Ouro
```

---

## 6. Regras de Autorizacao
- Apenas usuarios do time com telefone cadastrado podem interagir.
- O numero do WhatsApp e comparado com `Profile.phone` normalizado.
- Mensagens de numeros nao autorizados recebem resposta automatica.

---

## 7. Testes Recomendados
1. Testar verificacao do webhook (GET).
2. Enviar mensagem simples para o numero do bot.
3. Executar comandos basicos:
   - `/ajuda`
   - `/lead <telefone>`
   - `/novo ...`
4. Verificar criacao de lead e atividades.

---

## 8. Troubleshooting
**Webhook nao verifica**
- Confirme o verify token na UI.
- Verifique se a URL publica esta acessivel.

**Assinatura invalida**
- Verifique `META_APP_SECRET`.

**Numero nao autorizado**
- Confirme `Profile.phone` do usuario no time.

---

## 9. Seguranca
- Tokens criptografados em repouso.
- Assinatura validada em todo webhook.
- Dados sensiveis nao sao logados.

---

**Pronto!** O bot WhatsApp esta habilitado para sua operacao.

