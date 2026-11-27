# Progresso: assinaturas e add-ons

Referências: [01-feature.md](01-feature.md) · [02-frontend.md](02-frontend.md) · [03-backend.md](03-backend.md) · [05-decisoes.md](05-decisoes.md)

## Estado da entrega (2026-11-26)

Este arquivo é append-only. Os blocos de 2026-11-17 abaixo ficam como histórico e foram superados por este. Plano completo em [07-plano-das-fases.md](07-plano-das-fases.md).

| Item | Situação |
|---|---|
| Fase A | **Entregue.** PR #1381 mergeado na `develop` em 2026-11-18T17:49Z. |
| Fase B | **Entregue**, sem sandbox. PRs #1408 (2026-11-18), #1413 (2026-11-19), #1414 (2026-11-25) e #1431 (2026-11-26T15:06Z). |
| Fase C | **Entregue**, sem sandbox. PR #1432 mergeado em 2026-11-26T18:23Z. Ver [06-fase-c-renovacao.md](06-fase-c-renovacao.md). |
| Regularização do master (A e C) | **Entregue.** Botão no painel bloqueado (`039ba5d15`), checkout em `/pagamento/[supabaseId]`, add-on com login e confirmação com contador de 5 s (`1e6a8a88c`, `572020153`, `38595f69a`). D15 a D18. |
| Fase D | Não iniciada. Nenhum marcador de baixa externa na `develop`. |
| Fase E | Não iniciada. Nenhuma rota de assinatura usa `hasDelegatedTeamManagementAccess`. |
| Fase F | Parcial. Avisos da carência feitos (D12). Faltam destinatário correto e os degraus de janela fixa. |
| Fase G | Parcial. `ReadOnlyAccessBanner` no shell. Faltam botões de escrita desabilitados e a padronização visual. |
| Migrations `provider*` | Existem na `develop` (por exemplo `20261117120000_corretor_studio_pending_action_provider.sql`). Aplicação em banco compartilhado: Não verificado; segue o fluxo da pipeline, com autorização do dono. |
| Sandbox AbacatePay e Asaas | Não verificado. |
| Esta documentação | Branch `feature/assinaturas-plano-fases-docs`, criada de `origin/develop`. |

### Gates raiz em 2026-11-26

- [ ] R1: todos os nós e folhas com gate cumprido ou abandonado com motivo.
  - EVIDENCE: pendente. Fases D, E e F e parte da G seguem abertas, e vários gates dos nós antigos continuam sem evidência.
- [x] R2: typecheck, lint e suíte de testes passam.
  - EVIDENCE: no push de 2026-11-26 a validação do hook (`governance:sync`, `governance:check`, `lint`, `typecheck`, `test`) terminou com sucesso. Antes de corrigir o teste do e-mail de inadimplência, o `test` do hook tinha 1 falha (`OverdueReminderUseCase.test.ts`); depois do commit `c948f5230`, 0 falhas.
- [ ] R3: toda tela afetada passa por briefing `impeccable shape`, revisão `impeccable` e verificação no navegador.
  - EVIDENCE: parcial. As telas de regularização (F12, F13) têm briefing aprovado e foram vistas no navegador; a revisão `impeccable` completa e a verificação das telas da Fase A seguem pendentes.
- [ ] R4: revisão independente cobrindo conformidade com o plano, segurança e qualidade. Sem migration aplicada, sem cobrança real, sem deploy.
  - EVIDENCE: parcial. O PR #1432 teve revisão do Codex (3 comentários, corrigidos em `d57070db9`). As demais entregas não tiveram revisão independente registrada aqui.

## Auditoria (2026-11-26)

Comandos rodados em `HEAD`, que na data era `origin/develop` (branch `feature/assinaturas-plano-fases-docs` recém-criada).

| Verificação | Comando | Resultado |
|---|---|---|
| Fase A na `develop` (acesso) | `git grep -l "resolveBackofficeAccessMode" HEAD -- app lib` | `BackofficePlatformUsersUseCase.ts` e `BackofficePlatformUsersUseCase.planInfo.test.ts` |
| Fase A na `develop` (cancelar) | `git grep -l "canCancelInvoice" HEAD -- app lib` | `BackofficeInvoiceActionsMenu.tsx`, `invoiceActions.ts` e `invoiceActions.test.ts` |
| Fase A: carência genérica | `git grep -l "readOnlyWindow\|isGenericBillingGrace" HEAD -- app/api/services/featureAccess` | `FeatureAccessService.ts` |
| Fase B: cobrador roteado | `git grep -l "routed-charge" HEAD -- app lib` | `IncrementalBillingService.ts` e `BackofficePaymentUseCase.ts` |
| Fase B: migration `provider*` | `git grep -l "provider_external_id" HEAD -- supabase/migrations prisma` | 4 migrations, incluindo `20261117120000_corretor_studio_pending_action_provider.sql`, e `schema.prisma` |
| Regularização: painel | `git grep -l "FeatureBlockedPanel" HEAD -- app` | `FeatureBlockedPanel.tsx`, seu teste e `LayoutContent.tsx` |
| Regularização: rota, sessão e contador | `git grep -l "CheckoutAutoRedirect\|resolveLegacyBillingGracePaymentPath\|getServerSessionUserId" HEAD -- app components lib proxy.ts` | 9 arquivos, entre eles `proxy.ts`, `route-access.ts`, `server-session-user.ts` e `CheckoutAutoRedirect.tsx` |
| Fase D ausente | `git grep -nw "externalPayment\|markPaidExternally\|paidExternally" HEAD -- app lib prisma supabase/migrations` | sem resultado. (A busca sem `-w` acertava `externalPaymentId` do webhook, que não é a baixa externa.) |
| Fase D: ponto de entrada | `git grep -n "Confirmar recebimento em dinheiro" HEAD -- app` | `BackofficeClientInvoiceDetailsContainer.tsx`, linha 354 |
| Fase E ausente | `git grep -n "hasDelegatedTeamManagementAccess" HEAD -- "app/api/v1/subscription-management" "app/[supabaseId]/subscription" app/api/useCases/subscriptions` | sem resultado. O helper existe em `app/api/v1/utils/teamAccess.ts` (linha 298) |
| Fase G parcial | `git grep -l "ReadOnlyAccessBanner" HEAD -- app` | `ReadOnlyAccessBanner.tsx`, seu teste e `LayoutContent.tsx` |
| Merge dos PRs | `gh pr view <n> --json state,mergedAt` | #1381 2026-11-18T17:49:50Z; #1408 2026-11-18T20:10:40Z; #1413 2026-11-19T13:40:40Z; #1414 2026-11-25T15:19:52Z; #1431 2026-11-26T15:06:03Z; #1432 2026-11-26T18:23:13Z; #1395 2026-11-16T17:55:55Z; #1423 2026-11-23T15:02:55Z |

## Estado da entrega (2026-11-17)

| Item | Situação |
|---|---|
| Fase A no PR #1381 | implementada (A1, A2, A3). Faltam testes de A3, verificação no navegador e revisão impeccable. |
| Fase A na `origin/develop` | **não** implementada. |
| Branch local | 5 commits à frente de `origin/feature/bloqueio-assinatura-somente-leitura`, 0 atrás. Conciliação concluída, sem force. |
| Push | **bloqueado** pelo hook de pré-push (ver registro abaixo). Nada foi enviado nesta data. |
| Fase B | B1 (cobrança de add-on) e B2 (consulta de status) implementadas localmente. Cartão de add-on bloqueado até decisão. |
| Fase C | implementada na branch `feature/assinaturas-fase-c-renovacao-abacatepay` (backend, e-mail da carência e aviso na tela), sem sandbox. Depende dos commits da Fase B (PR #1414). Ver [06-fase-c-renovacao.md](06-fase-c-renovacao.md). |
| Fases D, E, G | não iniciadas, ou não verificadas. |
| Fase F | parcial: os dois avisos da carência foram feitos na Fase C (D12). |
| Migration `provider*` | criada (`supabase/migrations/20261117120000_corretor_studio_pending_action_provider.sql`), **não aplicada**. |

## Árvore de execução

- 1 Acesso em carência
  - 1.1 Liberação genérica por contrato (B1) — no PR
  - 1.2 Badge tri-estado do backoffice (B2, F1) — no PR
  - 1.3 Ação "Cancelar" fatura (F2) — no PR
- 2 Cobrança AbacatePay para add-ons
  - 2.1 Cobrança PIX de add-on (B3) — local
  - 2.2 Consulta de status (B4) — local
  - 2.3 Troca de forma de pagamento (B5) — pendente
  - 2.4 Webhook e reconciliação (B6, B7) — pendente
  - 2.5 Campo `provider` em modelos do backoffice (B8) — pendente
- 3 Renovação reativa pelo roteador (Fase C, B9) — implementada na branch da Fase C, sem sandbox
- 4 Gestão de faturas (Fase D, B10, F5) — pendente
- 5 Página de assinatura (Fase E, B11, F4) — pendente
- 6 Alertas por e-mail (Fase F, B12) — parcial: avisos da carência feitos na Fase C (D12)
- 7 Indicador de modo leitura e padronização visual (Fase G, F3, F6) — pendente

## Auditoria

Cada linha cita o comando usado e o resultado observado.

| Verificação | Comando | Resultado |
|---|---|---|
| Fase A ausente na develop | `git merge-base --is-ancestor 75984f629 origin/develop` | não é ancestral |
| Fase A presente no PR | `git merge-base --is-ancestor 75984f629 origin/feature/bloqueio-assinatura-somente-leitura` | é ancestral |
| Marcadores da Fase A na develop | `git grep` de `resolveBackofficeAccessMode` e `canCancelInvoice` na develop | nenhum encontrado |
| Marcadores da Fase A no PR | mesma busca no head do PR | 2 ocorrências de cada |
| Teste do botão Cancelar | `git grep` de `canCancelInvoice` em `*.test.tsx` no PR | nenhum |
| Migration de `provider*` | `git grep` de `provider_external_id` em `prisma/migrations` e `supabase/migrations` | **nenhuma** antes desta data. Lacuna corrigida em `fecc6af3f`. |
| Typecheck do estado final | `bun run typecheck` | exit 0 |
| Lint dos arquivos alterados | `npx eslint` nos arquivos da B1 e B4 | 0 erros, 2 avisos de complexidade |
| Testes de roteamento e status (isolados) | `bun test` nos três arquivos de B3 e B4 | 11 passam, 0 falham |
| Testes da pasta de billing sem isolamento | `bun test app/api/services/billing app/api/useCases/pendingActions ...` | 4 falhas em `PendingActionUseCase.test.ts`, causadas por `mock.module` em outros arquivos de teste. Não é o que o hook roda. |
| Suíte oficial (`bun run test`, com `--isolate`) | exit 1 | 6650 passam, **3 falham**, **3 erros** |
| Origem dos 3 erros | `git diff origin/develop HEAD` nas pastas envolvidas | arquivos idênticos à develop. Erro: `Export named 'withPrismaRetry' not found` em 3 suítes de `SubscriptionManagementUseCase`. **Pré-existente na develop.** |
| Origem dos 3 falhas | JUnit, leitura da saída | **não identificados**. O relatório JUnit mostra 0 falhas. Investigação pendente. |

## Registro cronológico (append-only)

- 2026-11-17: confirmado que a Fase A está no PR #1381 e ausente na develop. A Fase A estava marcada como não verificada na resposta anterior, o que foi corrigido.
- 2026-11-17: conciliação das branches. Merge do remoto no local (`8946e9ff1`), sem conflitos. Typecheck verde.
- 2026-11-17: primeiro push bloqueado pelo hook. Causa: falhas de B3 (`IncrementalBillingService` antigo). Corrigido com ajuste nos testes e bloqueio de cartão em `3bc6b4a8e`.
- 2026-11-17: segundo push bloqueado, agora por 3 falhas e 3 erros da suíte completa (ver auditoria). O erro de `withPrismaRetry` é pré-existente na develop.
- 2026-11-17: descoberta de que o commit `3c41d086e` declarou colunas `provider*` em `corretor_studio_pending_actions` sem migration. Corrigido em `fecc6af3f`.
- 2026-11-17: criação desta pasta de documentação, a partir do plano colado pelo usuário, no formato da rifa-casamento-online (plano, nós e folhas com gates, log append-only).
- 2026-11-17: usuário respondeu as três decisões abertas. Registradas em `05-decisoes.md` (D1 a D4). Pedido para apenas documentar, sem alterar código. Documentação atualizada nos quatro arquivos.

- 2026-11-25: Fase C. Decisão do dono: a renovação é reativa (carência, somente leitura, página de pagamento). O cron de cobrança antecipada (D-5) e o e-mail do PIX foram removidos (D8). Implementados: dois avisos por e-mail na carência (D12), `past_due` por data para contas do roteador (D14), corte do Asaas na confirmação do pagamento atrás do kill switch (D10, D11), prazo anterior normalizado na cotação, aviso de perda do ilimitado na tela de renovação (D13, briefing aprovado, seis passes do `impeccable`). Nada commitado, nada rodado contra provedores reais.

- 2026-11-25: validação da Fase C com banco real. Teste de integração novo (`test:integration:provider-renewal`, 8 testes, Postgres local) achou um defeito na consulta da carência: o filtro excluía quem só tem a data de vencimento no perfil (negação com data nula). Corrigido, teste verde. Suíte oficial `bun run test`: 6976 + 127 testes, 0 falhas (a auditoria de 2026-11-17 registrava 3 falhas e 3 erros na suíte completa; nesta data não há nenhum). Typecheck, lint e governança com exit 0.

- 2026-11-26: Fase C, botão de pagar do `/checkout` bloqueado até o aceite dos termos (D7). Briefing aprovado com as três recomendações, seis passes do `impeccable`, tela real vista em 1440, 375 e 320 px. E2E do checkout 18 de 18 (2 novos, 1 corrigido; controle negativo feito). Suíte oficial 6983 + 127, typecheck, lint e governança com exit 0. Não verificado: fase do cartão, retry de pagamento na tela, Safari e Firefox.

- 2026-11-26: revisão do Codex no PR #1432 (3 comentários inline, todos procedentes), corrigida em `d57070db9`. Id legado só no perfil agora é cancelado no corte; o sync do Asaas ignora conta com provedor do roteador; a transição para `past_due` usa o vencimento efetivo. Controle negativo: 5 testes de integração e 1 do sync falham sem as correções. Conversas respondidas e resolvidas. Suíte oficial 6987 + 127, typecheck, lint e governança com exit 0.

- 2026-11-26: PR #1432 com conflito contra a `develop`, que recebeu o PR #1431 e moveu a renovação para `/pagamento/[supabaseId]`. Merge normal da `develop` na branch (`84a1e98ef`), sem force; os avisos da carência passaram a apontar para a página nova. Suíte oficial 6997 + 127, typecheck, lint e governança com exit 0. Uma falha aparente de 4 testes (estouro de 5 s) foi do meu `.env` de exemplo esquecido na pasta, não do código.
- 2026-11-26: verificação das telas da Fase C. Tela de renovação real com dados reais (1440, 375 e 640 px), fase do cartão e retry do `/checkout` (campo simulado), E2E de checkout, add-on, adesão, estados do checkout, renovação e acesso da conta em Chromium (49 de 49) e checkout, renovação e cartão em Firefox (25 de 25). Correção de registro: o cartão do `/checkout` já passa pelo AbacatePay, a pendência estava errada. As seções da Fase C no `02-frontend.md` foram renumeradas para F10 e F11 (a `develop` já usava F8 e F9). Não verificado: WebKit (não abre com este Playwright), leitor de tela, tokenização real do cartão.

- 2026-11-18: Fase A entregue. PR #1381 mergeado na `develop` às 17:49Z. No mesmo dia, a Fase B começou a entrar: add-ons AbacatePay sem fallback Asaas (`495cb589b`) e correção do review do #1407 (`247e05ba2`, PR #1408 às 20:10Z).
- 2026-11-19: PR #1413 mergeado (13:40Z). Entrou a cobrança avulsa do backoffice por PIX e cartão (`cd40a2a87`) e o bloqueio da troca de forma quando a cobrança AbacatePay não tem `paymentId` (`e13b54b69`).
- 2026-11-23: refatoração do roteador e da confirmação agnósticas ao provedor (`3874db353`, `b49503ae6`), telefone do cliente obrigatório na cobrança (`57b19eb3a`). PR #1423 (`billing-grace-expiry-2026-12-05`) mergeado às 15:02Z.
- 2026-11-24: checkouts em fases com kit compartilhado (`f9676c7b1`, PR #1428) e add-ons AbacatePay com confirmação agnóstica e parcelamento por ciclo (`8242b3cff`, D6).
- 2026-11-25: PR #1414 mergeado (15:19Z). Botão "Regularizar assinatura" no painel "Acesso não liberado" (`039ba5d15`, D18): briefing aprovado, 6943 testes passando, validação do pre-push completa, prints em desktop e celular enviados no chat. A Fase C foi implementada na branch dela no mesmo dia (ver entradas acima).
- 2026-11-26: pedido do dono: o checkout de regularização abria dentro do shell com sidebar e precisava ser uma página própria, mantendo o usuário logado, com uma tela final que leva ao Corretor Studio em 5 s; o mesmo vale para o add-on. Briefing aprovado e três decisões (rota `/pagamento/[supabaseId]`, login no add-on, destino da tela final). Implementado em `1e6a8a88c` (D15, D16, D17).
- 2026-11-26: primeiro push bloqueado pelo pre-push: 1 falha em `OverdueReminderUseCase.test.ts`, que esperava o link antigo `/billing-grace-payment` no e-mail de inadimplência. Corrigido em `c948f5230`; o push seguinte passou nas 11 etapas da validação.
- 2026-11-26: pipeline do PR #1431 (run 45828436193) reprovou o E2E em 13 testes e bloqueou o Quality Gate. Causa principal: as páginas novas liam o usuário só pelo Supabase, e o cookie assinado do E2E não passa por ele, então o servidor mandava ao login. Corrigido com `getServerSessionUserId` (`572020153`), mais as URLs antigas em `account-access-gate.spec.ts` e `subscription.spec.ts`. O erro `Continuar` não encontrado nos 8 testes de add-on veio da mesma causa.
- 2026-11-26: segundo run (45840803886, commit `572020153`) com 2 falhas. Uma era nossa: o botão "Sair" do cabeçalho tinha 32 px em 360 px, abaixo dos 44 px que o teste de responsividade exige; corrigido em `38595f69a`. A outra, `templates-flow.spec.ts` (landing pages, `main#top` duplicado), não passa por arquivo alterado e a `develop` também tem falhas recentes de E2E; não foi tocada. O resultado do E2E depois de `38595f69a` não foi lido nesta nota.
- 2026-11-26: PR #1431 mergeado às 15:06Z. PR #1432 (Fase C) mergeado às 18:23Z, depois de merge da `develop` que moveu a renovação para `/pagamento/[supabaseId]`.
- 2026-11-26: a pedido do dono, o botão "Cancelar" do redirecionamento foi retirado da confirmação final (D17). O contador e "Ir agora" ficam. Validação: testes de `components/checkout` (19), lint e tela simulada no navegador sem o botão.
- 2026-11-26: documentação recriada. Este conjunto passa a ter o plano completo das fases A a G ([07-plano-das-fases.md](07-plano-das-fases.md)), as decisões D15 a D18, os nós B14, F12 e F13, os briefings das duas telas novas e os estados reconciliados com a `develop`. Auditoria dos estados na seção "Auditoria (2026-11-26)".

## Pendências que bloqueiam o push

1. **Autorização para pular o hook** (`--no-verify`). Os erros de `withPrismaRetry` e os 3 falhas não identificados existem no código atual, inclusive na develop. Não pulo o hook sem sua autorização explícita. Alternativa: corrigir os três arquivos de `SubscriptionManagementUseCase` antes do push, o que deixa de ser escopo desta feature.
2. **Identificar os 3 falhas** da suíte completa.

## Decisões respondidas em 2026-11-17

Registro completo em [05-decisoes.md](05-decisoes.md).

1. **Cartão de add-on (D1):** tokenizar no navegador com `abacatepay.js`, como a adesão já faz. O servidor recebe só o `ctok_`. Implementação pendente.
2. **Troca de forma de pagamento (D2):** cancelar a cobrança anterior nos dois sentidos. Implementação pendente.
3. **Decisão 13 (D4):** registrada em `05-decisoes.md`. Esta pasta passa a ser a fonte da feature, e o Obsidian não é mais atualizado.

Validação com o `develop`, pedida pelo usuário: a adesão já usa o provider AbacatePay com `ctok_` gerado no navegador (`AbacateCardField.tsx`). A busca por outros checkouts com `AbacatePay.create` ou `tokenize` no `develop` encontrou só esse componente. Add-on e assinatura (`CheckoutAsaasUseCase`) ainda não usam tokenização AbacatePay. Essa busca não foi exaustiva.

## Gates raiz

- [ ] R1: todos os nós e folhas com gate cumprido ou abandonado com motivo.
  - EVIDENCE: pendente. Hoje há 11 gates marcados (8 no backend, 3 no frontend) e 30 pendentes nesses dois documentos.
- [ ] R2: typecheck, lint e suíte de testes passam.
  - EVIDENCE: typecheck passa. Em 2026-11-17 a suíte completa falhava (3 falhas e 3 erros, ver auditoria). Na branch da Fase C, em 2026-11-25, `bun run test` terminou com exit 0 (6976 + 127 testes, 0 falhas), lint e governança também. Lembrete: isso vale para a branch da Fase C, que inclui a Fase B por merge; não foi rodado no PR #1381.
- [ ] R3: toda tela afetada passa pelo briefing `impeccable shape` e pela revisão `impeccable`, e é verificada no navegador.
  - EVIDENCE: pendente. Nenhuma tela da Fase A foi verificada no navegador.
- [ ] R4: revisão independente cobrindo conformidade com o plano, depois segurança e qualidade. Sem migration aplicada, sem cobrança real, sem deploy.
  - EVIDENCE: pendente.

## Fase C (renovação pelo roteador)

Status em 2026-11-25: a renovação é reativa (carência, somente leitura, página de pagamento), então o cron de D-5 foi removido (D8). Prontos e testados com portas simuladas: e-mail dos dois avisos da carência (D12), corte do Asaas na confirmação do pagamento atrás do kill switch (D10, D11) e prazo anterior normalizado para a pré-seleção (D13). Pendentes: aviso de perda do ilimitado na tela (briefing aguardando aprovação), cartão no `/checkout`, validação em sandbox. Detalhes em [06-fase-c-renovacao.md](06-fase-c-renovacao.md). A branch depende dos commits da Fase B (PR #1414, ainda não mergeada).
