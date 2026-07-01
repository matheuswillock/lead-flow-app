---
tags:
  - spec
  - mcp
  - tools
  - corretor-studio
parent: corretor-studio-mcp
canonical: specs/corretor-studio-mcp.md
updated: 2026-06-30
---

# MCP Corretor Studio — Catálogo de Tools

Nota satélite de [[corretor-studio-mcp]]. Prefixo: `studio_`. Fonte canônica: `specs/corretor-studio-mcp.md`.

## Regra transversal

Toda tool valida `resource.teamId === jwt.team_id` antes de executar.

Implementação: chama use cases diretamente (não HTTP loopback).

## Leitura (`readOnlyHint: true`)

| Tool | Input | Permissão |
|------|-------|-----------|
| `studio_list_my_teams` | — | Retorna só o time do token |
| `studio_list_leads` | status?, assigneeId?, page?, limit? | `hasLeadAccess` |
| `studio_get_lead` | leadId | `hasLeadAccess` |
| `studio_search_leads` | query, limit? | `hasLeadAccess` |
| `studio_list_tasks` | leadId?, dateFrom?, dateTo? | membership |
| `studio_get_task` | taskId | via lead.teamId |
| `studio_get_meeting` | leadId | `hasLeadAccess` |
| `studio_list_meetings` | dateFrom, dateTo | membership |
| `studio_list_attachments` | leadId | `hasLeadAccess` |

## Escrita

| Tool | Use case / serviço | Annotations |
|------|-------------------|-------------|
| `studio_create_lead` | `LeadUseCase` | — |
| `studio_update_lead` | `LeadUseCase` | — |
| `studio_delete_lead` | `LeadUseCase` | `destructiveHint: true` |
| `studio_create_task` | `CreateTaskUseCase` | — |
| `studio_update_task` | task use case | — |
| `studio_cancel_task` | cancel logic | sem hard delete |
| `studio_schedule_meeting` | `LeadScheduleService` | — |
| `studio_update_meeting` | schedule PATCH | — |
| `studio_cancel_meeting` | schedule cancel | — |
| `studio_upload_attachment` | `LeadAttachmentUseCase` | base64, max 10 MB |
| `studio_delete_attachment` | `LeadAttachmentUseCase` | `destructiveHint: true` |

## Mapeamento código existente

| Domínio | Referência |
|---------|------------|
| Auth | `app/api/v1/utils/teamAccess.ts` |
| Leads | `app/api/useCases/leads/LeadUseCase.ts` |
| Reuniões | `app/api/services/leadSchedule/LeadScheduleService.ts` |
| Tarefas | `app/api/useCases/task/CreateTaskUseCase.ts` |
| Anexos | `app/api/useCases/leadAttachments/LeadAttachmentUseCase.ts` |

## Lacunas API atual

- `CreateTaskUseCase` só via `leads/[id]/activities` — MCP chama use case direto
- Sem `POST /api/v1/tasks` dedicado
- Sem hard delete de tarefas — v1 usa `studio_cancel_task`
- Anexos: rota usa auth inline — MCP unifica via `getMcpAccess`

## Upload attachment

Input da tool:

```json
{
  "leadId": "uuid",
  "fileName": "proposta.pdf",
  "mimeType": "application/pdf",
  "contentBase64": "..."
}
```

Servidor decodifica → `File` → `LeadAttachmentUseCase.uploadAttachment`.

## Diretório de conectores

Toda tool precisa:

- `annotations.title`
- `readOnlyHint` / `destructiveHint` / `idempotentHint` conforme operação
- Nome ≤ 64 caracteres

Ver: [[corretor-studio-mcp/oauth]] · [[corretor-studio-mcp/security]]
