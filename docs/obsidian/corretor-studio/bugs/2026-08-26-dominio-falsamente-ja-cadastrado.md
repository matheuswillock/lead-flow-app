# 🐛🚫 Resolvido: Domínio informado como já cadastrado sem cadastro local aparente

## Status

- Data da investigação: 2026-08-26
- Status: resolvido para o caso de conflito de subdomínio de tracking
- Commit da investigação: `6209e77d`
- Commit da correção: `933821d5`
- PR da correção: pendente

## Achado

Clientes tentaram cadastrar um novo domínio e receberam:

> Este domínio já está cadastrado. Verifique se não foi conectado antes ou use outro domínio.

O relato indica que o domínio não aparece cadastrado no sistema.

## Evidências

Evidência sanitizada do HAR fornecido:

- Data/hora: 2026-08-26 às `10:38:58-03`.
- Página: `/5b36cd1a-898b-4545-b8ed-97469fd24a34/email/configuracoes`.
- Endpoint: `POST /api/q/email/settings/domain`.
- Payload: `{"domainName":"onsidemarketing.com.br"}`.
- Resposta: `400`.
- Corpo da resposta: `{"isValid":false,"errorMessages":["Este domínio já está cadastrado. Verifique se não foi conectado antes ou use outro domínio."],"result":null}`.

Cookies, tokens e headers sensíveis foram omitidos.

Evidência Vercel:

- Em `2026-08-25T03:25:21Z` até `2026-08-26T13:47:26Z`, a Vercel agrupou `12` runtime errors em `/api/v1/email/settings/domain`, afetando `3` usuários.
- Último deployment observado: `dpl_nHa9r5fcmFzMZJ9C14d2hsjznjgS`.
- Erro amostral do Resend:

```text
statusCode: 409
message: A tracking domain with the subdomain "links" already exists for this domain.
name: validation_error
```

## Sentry

- O plugin/skill `sentry:sentry` foi usado na investigação em 2026-08-26.
- Existe `SENTRY_AUTH_TOKEN` local em `.env`, mas as chamadas oficiais ao Sentry retornaram `HTTP 403` para a organização/projeto configurado (`corretor-studio/sentry-camel-flower`).
- Sem o escopo/permissão de leitura no Sentry, não foi possível recuperar eventos ou issues adicionais. Nenhum token foi registrado na nota.

## Investigação

A mensagem vem do mapeamento de erro do Resend em `lib/email/map-resend-domain-error.ts`. Quando o provedor retorna algo como `already exists`, a UI recebe uma mensagem que pode soar como cadastro local existente, mesmo quando o conflito está no provedor ou em um domínio órfão.

O achado da Vercel indica um caso mais específico: o `create` do domínio pode passar, mas o `update` de tracking falha com `409` porque o subdomínio padrão `links` já existe no Resend. O use case estava passando esse erro para `mapResendDomainError` com contexto `"connect"`, então o mapper retornava a mensagem genérica de domínio já cadastrado.

## Correção

`EmailTeamSettingsUseCase.connectDomain` agora passa o erro do update de tracking com contexto `"tracking"`. Com isso, o usuário deixa de receber:

> Este domínio já está cadastrado. Verifique se não foi conectado antes ou use outro domínio.

E passa a receber:

> Este subdomínio de tracking já está em uso no Resend. Escolha outro subdomínio ou use o que já está vinculado a este domínio.

Foi adicionado teste focado para o caso real do provider:

- `app/api/useCases/email/EmailTeamSettingsUseCase.connect-domain.test.ts`
- `lib/email/map-resend-domain-error.test.ts`

## Recomendação restante

Diferenciar as mensagens:

- domínio já conectado no time atual: orientar remover o domínio atual antes de conectar outro.
- domínio existente no provedor ou órfão: orientar contato com suporte/reconciliação, em vez de sugerir que o domínio está cadastrado localmente.
- subdomínio de tracking existente: orientar suporte/reconciliação de tracking, não troca de domínio.

Não apagar domínio no Resend nem alterar banco remoto sem autorização explícita.

Referências de código:

- `app/api/useCases/email/EmailTeamSettingsUseCase.ts`
- `lib/email/map-resend-domain-error.ts`
