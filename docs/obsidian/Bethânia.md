---
tags:
  - bethania
  - n8n
  - corretor-studio
aliases:
  - Studio Bot
  - Bot N8N
created: 2026-06-30
updated: 2026-06-30
---

# Bethânia — Bot N8N

Assistente conversacional do Corretor Studio (WhatsApp plataforma, orquestração **N8N**, sem LLM em v1).

## Documentação

- **Spec completa:** [[Bethânia — Bot N8N]]
- **Repo:** `lead-flow-app` → `specs/studio-bot-n8n.md`
- **Dev local:** `n8n/README.md` no repositório

## Comandos úteis

```bash
bun run n8n:up          # sobe stack Docker N8N (:5678)
bun run dev             # app + N8N (auto-start)
bun run dev -- --skip-n8n
```

## Onde está no produto

| Área | Local |
|------|--------|
| Vincular número | Minha conta → Conexões |
| Admin canal | Backoffice → **Bethânia** |
| Workflows | `n8n/workflows/` (importar na UI N8N) |

## Relacionado

- [[WhatsApp]] — inbox de **leads** por time (domínio separado)
- [[Backoffice - Visão Geral]]
