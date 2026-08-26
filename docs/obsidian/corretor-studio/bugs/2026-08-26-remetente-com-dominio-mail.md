# Bug: Remetente bloqueado por domínio com prefixo mail

## Status

- Data da investigação: 2026-08-26
- Status: corrigido em código local
- Commit da correção: pendente
- PR da correção: pendente

## Achado

O cadastro de remetente bloqueava casos válidos quando o domínio cadastrado no Resend tinha o prefixo `mail.` e o remetente usava o domínio raiz.

Caso real:

- Domínio cadastrado: `mail.libercorretora.com.br`
- Remetente bloqueado: `alexandre@libercorretora.com.br`

Esse remetente deve ser aceito.

## Evidências

- Em 2026-08-25, a Vercel registrou `POST /api/q/email/settings/senders` retornando `400` quatro vezes no deployment `dpl_6eu2mj2zE1jucYEJPHCNkmQb5m7i`.
- A regra anterior comparava o domínio do remetente com o domínio cadastrado e não aceitava o domínio raiz quando o cadastrado era `mail.<domínio>`.
- A consulta ao Sentry não retornou evidências adicionais nesta investigação porque o acesso disponível retornou `403`.

## Correção

A validação em `lib/email/resolve-campaign-from.ts` agora normaliza apenas o prefixo inicial `mail.` no domínio cadastrado e no domínio do remetente antes de comparar a raiz:

- `mail.libercorretora.com.br` aceita `alexandre@libercorretora.com.br`.
- `libercorretora.com.br` aceita `alexandre@mail.libercorretora.com.br`.
- domínio igual continua aceito.
- domínio realmente diferente continua bloqueado.

Também foi adicionado feedback visual na página de configurações de e-mail para exibir a mensagem específica:

> Não foi possível cadastrar o remetente porque ele não possui o domínio cadastrado. Use um e-mail com o domínio cadastrado (@dominio...).

## Validação

Testes focados foram adicionados para `createSender`, `updateSender` e para a regra pura de domínio.

Referências de código:

- `lib/email/resolve-campaign-from.ts`
- `lib/email/resolve-campaign-from.test.ts`
- `app/api/useCases/email/EmailTeamSettingsUseCase.test.ts`
- `app/[supabaseId]/email/configuracoes/features/context/EmailSettingsHook.ts`
- `app/[supabaseId]/email/configuracoes/features/components/SenderCard.tsx`
