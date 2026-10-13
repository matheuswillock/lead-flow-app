# Backend

Leia este arquivo somente para mudanças em APIs, UseCases, Services, Repositories, webhooks ou backoffice.

## Arquitetura

- Fluxo canônico: `Route -> UseCase -> [Service] -> Repository/Prisma`.
- Routes tratam apenas HTTP: autenticação, parsing, chamada do UseCase e mapeamento de status.
- Um UseCase representa um caso de uso e retorna `Output` de `lib/output/index.ts`.
- Services concentram lógica de domínio complexa. Repositories concentram acesso a dados.
- UseCases dependem de interfaces e não acessam Prisma ou SQL raw diretamente.
- Services e Repositories novos possuem interface enxuta e implementação substituível.
- Queries Prisma preferem `select`; use `include` somente quando a entidade relacionada completa for necessária.
- Logs de rota usam nome estável e método, `console.info` para fluxo e `console.error` para erros.

## Autorização e contexto

- Rotas de produto usam os helpers de acesso existentes e propagam o contexto resolvido pela cadeia, sem repetir consultas de identidade/time.
- Quando `getTeamAccess()` for usado, passe `TeamContext` para UseCase, Service e Repository.
- APIs novas de produto ficam em `/api/v1`; webhooks, auth e infraestrutura permanecem nos namespaces existentes.
- Chamadas client-side usam `API_CLIENT_BASE`; chamadas server-side seguem o route map existente.

## Backoffice

- O backoffice é isolado do produto. Entidades, enums, rotas, services, use cases, repositories e variáveis de ambiente são dedicados e prefixados quando aplicável.
- Rotas usam `getBackofficeAccess()`, nunca `getTeamAccess()`.
- O único vínculo permitido com o produto é `Profile`/`BackofficeUser.profileId`.

## Webhooks

- Verifique assinatura antes de reconhecer o evento.
- Responda rapidamente e processe com `after()` ou mecanismo assíncrono existente.
- Persistir falhas em outbox, aplicar retry limitado com backoff e deduplicar por chave idempotente.
- Reutilize o padrão de webhook já existente antes de criar nova infraestrutura.

## Entrega da API

- Atualize a coleção e o environment Postman ao criar ou alterar endpoint.
- Feature com `featureSlug` exige migration de dados criada pela CLI e atualização de `prisma/seed-backoffice-products.ts`.
- Consulte `.governance/ai/database.md` antes de schema, SQL ou migration.
- Consulte as allowlists em `.governance/ai-governance.config.json` antes de tocar código legado. Uma exceção relacionada ao arquivo alterado deve ser removida na mesma mudança.
