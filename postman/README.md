# Postman - Lead Flow API (Unified)

Este diretório agora usa **uma única collection** com pastas e subpastas por contexto.

## Arquivos

- `Lead-Flow-API-Collection.json`: collection única (Dashboard, Leads, Manager Users, Profiles, Permanent Subscription)
- `Lead-Flow-Environment.json`: variáveis de ambiente
- `test-dashboard-api.sh`: script opcional de teste via terminal

## Estrutura da Collection

- `Auth`
  - `Login - Obter Token`
- `Dashboard`
  - `Requests` (subpasta)
- `Leads`
  - `Requests` (subpasta)
- `Manager Users`
  - `Requests` (subpasta)
- `Profiles`
  - `Requests` (subpasta)
- `Permanent Subscription`
  - `Requests` (subpasta)
- `API Coverage - All Routes`
  - Subpastas por domínio (`v1`, `auth`, `email`, `webhooks`, `demo`)
  - Subpastas internas por contexto (ex.: `leads`, `profiles`, `subscriptions`, etc.)
  - Contém todas as rotas detectadas em `app/api/**/route.ts` (auto-gerado)

## Autenticação Automatizada

1. Configure no environment:
   - `baseUrl`
   - `loginEmail`
   - `loginPassword`
2. Execute `Auth > Login - Obter Token`.
3. O script de teste salva automaticamente:
   - `accessToken` / `access_token`
   - `refreshToken` / `refresh_token`
   - `supabaseUserId` / `supabaseId`
4. As demais rotas usam `Bearer {{accessToken}}` automaticamente.

## Endpoint de Assinatura por supabaseId

A collection já inclui a rota:

- `GET /api/v1/subscriptions/by-supabase/{supabaseId}`

Ela retorna:

- dados locais de assinatura
- dados completos da assinatura no Asaas (quando existir)
- status `isActive` da assinatura no Asaas

## Observações

- Variáveis legadas (`BASE_URL`, `SUPABASE_ID`, `USER_EMAIL`, `USER_PASSWORD`) foram mantidas por compatibilidade.
- O header `x-supabase-user-id` continua disponível nas rotas que exigem esse identificador.
- A pasta `API Coverage - All Routes` foi adicionada para garantir cobertura completa das rotas da API.

## Como Importar e Rodar

### Postman

1. Abra o Postman e clique em `Import`.
2. Importe:
   - `postman/Lead-Flow-API-Collection.json`
   - `postman/Lead-Flow-Environment.json`
3. Selecione o environment `Lead Flow App - Development`.
4. Preencha no environment:
   - `baseUrl`
   - `loginEmail`
   - `loginPassword`
5. Execute `Auth > Login - Obter Token`.
6. Execute as pastas de contexto (`Dashboard`, `Leads`, `Manager Users`, `Profiles`, `Permanent Subscription`).

### Insomnia

1. Abra o Insomnia.
2. Vá em `Application > Preferences > Data > Import Data` (ou `Create > Import`).
3. Importe o arquivo `postman/Lead-Flow-API-Collection.json`.
4. Crie/edite um Environment com:
   - `baseUrl`
   - `loginEmail`
   - `loginPassword`
   - `accessToken` (será preenchido após login)
   - `supabaseUserId`
5. Rode a request `Auth > Login - Obter Token`.
6. Rode as demais requests por contexto.

### Bruno

1. Abra o Bruno.
2. Crie uma collection local e use `Import Collection` para importar `postman/Lead-Flow-API-Collection.json` (formato Postman).
3. Crie um Environment (ex.: `dev`) e copie as variaveis de `postman/Lead-Flow-Environment.json`.
4. Defina:
   - `baseUrl`
   - `loginEmail`
   - `loginPassword`
5. Execute `Auth > Login - Obter Token`.
6. Execute as requests das pastas de contexto.

### HTTPie

HTTPie nao importa collection, entao rode via comando.

1. Login para obter token:

```bash
http POST :3000/api/auth/login email=seu-email password=sua-senha
```

2. Salvar token em shell (macOS/Linux, com `jq`):

```bash
TOKEN=$(http POST :3000/api/auth/login email=seu-email password=sua-senha | jq -r '.result.session.access_token')
USER_ID=$(http POST :3000/api/auth/login email=seu-email password=sua-senha | jq -r '.result.user.id')
```

3. Chamar endpoint com Bearer:

```bash
http GET :3000/api/v1/subscriptions/by-supabase/$USER_ID Authorization:"Bearer $TOKEN"
```

4. Exemplo de rota que usa header de usuario:

```bash
http GET ":3000/api/v1/leads?page=1&limit=10" Authorization:"Bearer $TOKEN" x-supabase-user-id:$USER_ID
```
