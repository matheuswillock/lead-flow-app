# Progresso: assinaturas e add-ons

Referências: [01-feature.md](01-feature.md) · [02-frontend.md](02-frontend.md) · [03-backend.md](03-backend.md) · [05-decisoes.md](05-decisoes.md)

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
