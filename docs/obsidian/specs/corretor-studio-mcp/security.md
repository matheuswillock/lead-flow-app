---
tags:
  - spec
  - mcp
  - security
  - corretor-studio
parent: corretor-studio-mcp
canonical: specs/corretor-studio-mcp.md
updated: 2026-06-30
---

# MCP Corretor Studio — Segurança

Nota satélite de [[corretor-studio-mcp]]. Fonte canônica: `specs/corretor-studio-mcp.md`.

## Threat model

| Vetor | Mitigação |
|-------|-----------|
| Token theft | TTL curto, refresh hash, revogação UI |
| Cross-team leak | `team_id` no JWT + validação em toda tool |
| CSRF consent | parâmetro `state` OAuth |
| DCR abuse | rate limit no register |
| DoS | rate limit IP + client_id + profile_id |
| PII em logs | logar tool/profileId/teamId, não payloads |

## Autorização

`getMcpAccess(bearerToken)`:

1. Verificar JWT (`MCP_OAUTH_JWT_SECRET`)
2. Validar grant não revogado em `TeamMcpOAuthGrant`
3. Carregar `teamMember` (membership ativa)
4. Checar `isAccountSubscriptionActive`
5. Retornar contexto equivalente a `TeamAccess`

Reutilizar:

- `hasLeadAccess(teamMember)` — leitura leads
- `hasLeadActivityAccess(teamMember)` — atividades

## Escopo por time

- JWT fixa `team_id` no consentimento OAuth
- `studio_list_my_teams` retorna **apenas** o time do token
- Lead/task/meeting de outro time → **404** (não vazar existência)

## Rate limiting

Arquivo proposto: `lib/mcp/rate-limit.ts`

Referência: `.claude/skills/build-mcp-app/references/abuse-protection.md`

Tier sugerido:

- Por `client_id` + `profile_id`
- Por IP (tier Anthropic egress se listado)

## Revogação

- UI Integrações: `DELETE /api/v1/integrations/mcp`
- Set `revokedAt` no grant
- Tokens existentes falham no próximo `getMcpAccess`

## Feature PUBLIC ≠ authless

`studio-mcp` com `accessMode: PUBLIC` controla visibilidade na sidebar.

O servidor MCP **sempre** exige OAuth Bearer — nunca authless em produção.

## Comparação Studio Webhook

| | Studio Webhook | MCP |
|--|----------------|-----|
| Auth | PAT na URL | OAuth JWT |
| Direção | Inbound | Bidirecional |
| Escopo | Criar lead | CRUD CRM |
| Listável diretório | Não | Sim (com OAuth) |

Ver: [[corretor-studio-mcp/oauth]] · [[corretor-studio-mcp/tools]]
