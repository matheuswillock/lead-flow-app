---
mode: 'agent'
description: 'Consultar o schema do banco de dados Lead Flow sem exploração desnecessária de arquivos'
---

<!-- GENERATED FILE - DO NOT EDIT DIRECTLY -->
<!-- Source: .claude/skills/db-schema.md -->
<!-- Regenerate with: bun run skills:sync -->


Consulte o schema do banco de dados Lead Flow de forma direta e eficiente.

## Passo 1 — Ler o schema

Leia diretamente o arquivo do Prisma:
```
prisma/schema.prisma
```

Este arquivo contém todos os modelos, campos, tipos, relações e enums do banco de dados PostgreSQL.

## Passo 2 — Contexto adicional (se necessário)

Se precisar de contexto sobre como os modelos são usados na aplicação, leia:
```
.github/instructions/project-context.instructions.md
```
A seção "Schema do Banco de Dados" contém descrições dos principais modelos.

## Modelos principais (referência rápida)

- `Profile` — usuário do sistema (manager ou operator), vinculado ao Supabase Auth
- `Team` — time de vendas criado por um manager
- `Lead` — lead gerenciado no funil de vendas
- `LeadsSchedule` — agendamentos de leads (Google Calendar)
- `LeadActivity` — histórico de atividades/status de um lead
- `Subscription` — assinatura do manager no Asaas
- `TeamPreset` — presets de filtro de time
- `TeamStatusRule` — regras de status por time

## Instruções

Responda à pergunta do usuário sobre o schema baseando-se exclusivamente no conteúdo de `prisma/schema.prisma`. Não explore outros arquivos a menos que seja estritamente necessário para responder.
