# Roadmap — Reuso de conexão Google entre Corretor Studio e Backoffice

## Objetivo

Centralizar conexões OAuth Google em uma tabela única (`google_oauth_connections`) e permitir reuso no backoffice via vínculo com `Profile`, eliminando necessidade de reconectar contas.

## Convenções deste roadmap

- Status: `TODO` → `IN_PROGRESS` → `DONE`
- Cada item concluído deve ser marcado no checklist.
- Ao abrir PR, adicionar o link no bloco **PRs**.
- Plano original de referência: `C:\Users\mathe\.claude\plans\vamos-criar-um-plano-tidy-lynx.md`

## Fase 1 — Fundação de dados + compatibilidade

- [x] DONE: Criar migration #1 (`create_google_oauth_connections_and_backfill`) com:
  - nova tabela `google_oauth_connections`
  - novas FKs em `corretor_studio_profiles` e `backoffice_users`
  - coluna `linkedCorretorStudioProfileId` em `backoffice_users`
  - backfill idempotente Profile/BackofficeUser
  - bootstrap idempotente dos 3 vínculos (Bruno/Nathiele/Matheus)
- [x] DONE: Atualizar `prisma/schema.prisma` com `GoogleOAuthConnection` e novas relações
- [x] DONE: Criar helpers em `lib/google/connection.ts` (`isGoogleConnectionActive`, `resolveBackofficeGoogleConnection`)
- [x] DONE: Criar repositório `googleOAuthConnection` (interface + implementação)
- [x] DONE: Criar resolver backoffice `BackofficeGoogleConnectionResolverService` (interface + implementação)
- [x] DONE: Refatorar `BackofficeGoogleCalendarService` para usar connection repository e persistir refresh/error
- [x] DONE: Refatorar `BackofficeLeadScheduleService` para usar resolver (organizer derivado)
- [x] DONE: Refatorar `BackofficeCalendarAvailabilityService` para resolver conexões sem N+1
- [x] DONE: Refatorar `GoogleCalendarService` (Corretor Studio) para organizer baseado em conexão
- [x] DONE: Ajustar callers impactados (lead schedule, calendar availability, cancel/resend, tasks, use cases)
- [x] DONE: Manter compatibilidade de DTOs (`googleCalendarConnected` derivado) e incluir `googleConnectionSource`
- [x] DONE: Atualizar rotas de connect/disconnect com regras de conflito e `force: true` quando houver dependentes
- [x] DONE: Atualizar `BackofficeAccountUseCase` para fluxo baseado em connection central
- [x] DONE: Incluir `NotificationType.GOOGLE_CONNECTION_BROKEN` e disparos no erro de refresh
- [x] DONE: Atualizar Postman se houver mudança de contrato em current-user/backoffice current-user

## Fase 2 — Consolidação pós-estabilização

- [x] DONE: Remover dual-write e manter escrita apenas na tabela central
- [x] DONE: Validar janela de observação (24-48h) e registrar evidências (ver `docs/google-oauth-connections-phase2-evidence.md`)

## Fase 3 — Limpeza legada

- [x] DONE: Criar migration #2 (`drop_legacy_google_columns`) após deploy estável
- [x] DONE: Criar migration de backfill complementar para `Profile.googleConnectionId` pendente (`20260526230736_backfill_missing_profile_google_connection_id.sql`)
- [x] DONE: Remover colunas legadas `google*` de `Profile` e `BackofficeUser` no schema
- [x] DONE: Remover uso de campos legados em repositórios/inputs (`BackofficeUserRepository.update`, `UpdateBackofficeUserInput`)
- [x] DONE: Validar queries pós-limpeza

## Verificação obrigatória por etapa

- [x] DONE: `bun run typecheck 2>&1 | head -20`
- [x] DONE: `bun run lint`
- [x] DONE: `bun run governance:check`
- [ ] TODO: `bun run design:check` (somente quando houver alteração visual)

## PRs

- PR 1: _pendente_
- PR 2: _pendente_
- PR 3: _pendente_
