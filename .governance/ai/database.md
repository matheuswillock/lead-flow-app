# Banco de dados e migrations

Leia este arquivo somente para Prisma, SQL, Supabase, RLS, triggers, seeds ou migrations.

## Segurança

- Não aplique migration, SQL, seed, reset, `db push` ou alteração em banco compartilhado/remoto sem autorização explícita do owner.
- Antes de excluir dados, confira relações e FKs no schema.
- Prefira Prisma Client a SQL raw.

## Fonte de verdade

- `prisma/schema.prisma` define models, enums, campos, índices e nomes físicos com `@@map`/`@map`.
- `app/api/infra/data/prisma.ts` é o boundary do cliente compartilhado.
- SQL raw e migrations usam exclusivamente nomes físicos do schema. Nunca inferir tabela ou coluna a partir do nome do model.

## Criação

- Schema Prisma: primeiro execute o dry-run e depois `bun run db:migrate:from-prisma -- <nome>`.
- RLS, functions, triggers, grants, publications, extensions e seeds manuais: `bun run db:migrate:new <nome>`.
- Não crie arquivos manualmente em `supabase/migrations/`.
- Torne SQL idempotente quando possível e revise `CREATE`, `ALTER`, `REFERENCES` e enums contra o schema.

## Validação local

```bash
bun run db:migrate:from-prisma -- --dry-run <nome>
bun run db:migrate:reset:local
bun run prisma:db:push
```

Execute apenas os comandos aplicáveis à mudança. Um reset local destrutivo deve apontar exclusivamente para a instância local conhecida.

## Remoto

Após autorização explícita:

```bash
bun run db:migrate:push:dry-run
bun run db:migrate:push
bun run db:migrate:status
```

Hotfix feito no SQL Editor deve ser reconciliado em migration criada pela CLI antes da conclusão.
