# 🐛🚫 Resolvido: Remetente bloqueado por domínio com prefixo mail

## Status

- Data da investigação: 2026-08-26
- Status: resolvido em código local
- Commit da investigação: `6209e77d`
- Commit da correção: `6209e77d`
- Commit desta atualização: `933821d5`
- PR da correção: pendente

## Achado

O cadastro de remetente bloqueava casos válidos quando o domínio cadastrado no Resend tinha o prefixo `mail.` e o remetente usava o domínio raiz.

Caso real:

- Domínio cadastrado: `mail.libercorretora.com.br`
- Remetente bloqueado: `alexandre@libercorretora.com.br`

Esse remetente deve ser aceito.

## Evidências

- Em 2026-08-25, a Vercel registrou `POST /api/q/email/settings/senders` retornando `400` quatro vezes no deployment `dpl_6eu2mj2zE1jucYEJPHCNkmQb5m7i`.
- Horários observados na Vercel para o mesmo endpoint e deployment:
  - `19:33:08Z`
  - `19:35:45Z`
  - `19:40:08Z`
  - `19:57:37Z`
- A regra anterior comparava o domínio do remetente com o domínio cadastrado e não aceitava o domínio raiz quando o cadastrado era `mail.<domínio>`.

## Sentry

- O plugin/skill `sentry:sentry` foi usado na investigação em 2026-08-26.
- Existe `SENTRY_AUTH_TOKEN` local em `.env`, mas as chamadas oficiais ao Sentry retornaram `HTTP 403` para a organização/projeto configurado (`corretor-studio/sentry-camel-flower`).
- Sem o escopo/permissão de leitura no Sentry, não foi possível recuperar eventos ou issues adicionais. Nenhum token foi registrado na nota.

## Correção

A validação em `lib/email/resolve-campaign-from.ts` agora normaliza apenas o prefixo inicial `mail.` no domínio cadastrado e no domínio do remetente antes de comparar a raiz:

- `mail.libercorretora.com.br` aceita `alexandre@libercorretora.com.br`.
- `libercorretora.com.br` aceita `alexandre@mail.libercorretora.com.br`.
- domínio igual continua aceito.
- domínio realmente diferente continua bloqueado.

Também foi adicionado feedback visual na página de configurações de e-mail para exibir a mensagem específica:

> Não foi possível cadastrar o remetente porque ele não possui o domínio cadastrado. Use um e-mail com o domínio cadastrado (@dominio...).

Essa mensagem aparece em um `Alert` da própria página de configurações de e-mail, com título `Remetente não cadastrado`, além do toast. Assim o erro não fica restrito ao console nem cai apenas em feedback genérico.

## Validação

Testes focados foram adicionados para `createSender`, `updateSender` e para a regra pura de domínio.

O texto usado no alert visual foi coberto por teste unitário em `app/[supabaseId]/email/configuracoes/features/context/EmailSettingsHook.test.ts`.

Também foi adicionada uma spec E2E em `e2e/specs/product/email-configuracoes.spec.ts` cobrindo o carregamento autenticado da página de configurações de e-mail. A execução local chegou ao runner do Playwright, mas ficou bloqueada no setup porque o seed E2E está ausente na base local:

```text
Seed E2E ausente — rode `bun run db:seed:e2e`
```

A tentativa de seed local já havia falhado por drift de migration history local; nenhuma alteração remota foi feita.

Referências de código:

- `lib/email/resolve-campaign-from.ts`
- `lib/email/resolve-campaign-from.test.ts`
- `app/api/useCases/email/EmailTeamSettingsUseCase.test.ts`
- `app/[supabaseId]/email/configuracoes/features/context/EmailSettingsHook.ts`
- `app/[supabaseId]/email/configuracoes/features/components/SenderCard.tsx`
