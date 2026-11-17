# Frontend: assinaturas e add-ons

Referência: [01-feature.md](01-feature.md) · Progresso: [04-progresso.md](04-progresso.md)

Legenda dos gates: `[x]` verificado no código ou em teste nesta data; `[ ]` pendente. Cada gate indica o comando de verificação e a evidência registrada.

Regra de origem: toda tela afetada passa primeiro pelo briefing `impeccable shape`, com aprovação antes do JSX. Depois da implementação, passa pela revisão `impeccable`. Nenhuma tela é reportada como pronta sem as duas etapas.

## F1. Badge de acesso do backoffice (Fase A2)

**Estado:** implementado no head do PR #1381 (`ccb52a4ae`). Ausente na `origin/develop`.

**Arquivos:** `app/backoffice/(app)/clients/[masterId]/features/container/BackofficeClientDetailsContainer.tsx`. O rótulo "Acesso (leitura)" está na linha 644.

- [x] F1.G1: rótulo do estado de leitura presente no PR.
  - CHECK: `git grep -n "Acesso (leitura)" origin/feature/bloqueio-assinatura-somente-leitura -- app/backoffice`
  - EVIDENCE: linha 644 do container.
- [ ] F1.G2: os três estados ("Acesso total", "Acesso (leitura)", "Sem acesso") renderizados na tela.
  - EVIDENCE: pendente. Só "Acesso (leitura)" foi confirmado no container. "Acesso total" e "Sem acesso" não foram localizados nesse arquivo.
- [ ] F1.G3: briefing `impeccable shape` aprovado antes do JSX.
  - EVIDENCE: não encontrado no repositório.
- [ ] F1.G4: validado no navegador em desktop e mobile.
  - EVIDENCE: pendente.
- [ ] F1.G5: revisão `impeccable` aplicada.
  - EVIDENCE: pendente.

## F2. Ação "Cancelar" na aba Faturas (Fase A3)

**Estado:** implementado no head do PR #1381. Ausente na `origin/develop`.

**Arquivos:** mesmo container de F1.
- `canCancelInvoice` (linha 115): só mostra o botão quando a fatura não é `adhesion_external`, não está paga e não está `WAIVED`.
- Botão "Cancelar" na linha da tabela (linha ~1310).
- `AlertDialog` "Cancelar esta fatura?" (linha ~1651), com ação "Cancelar fatura".

- [x] F2.G1: botão, condição de exibição e confirmação presentes no PR.
  - CHECK: `git grep -n "canCancelInvoice\|Cancelar esta fatura" origin/feature/bloqueio-assinatura-somente-leitura -- "app/backoffice"`
- [ ] F2.G2: teste automatizado do botão e da condição de exibição.
  - CHECK: `git grep -ln "canCancelInvoice\|Cancelar fatura" <ref> -- "*.test.tsx"`
  - EVIDENCE: nenhum teste encontrado. O plano exige esse teste.
- [ ] F2.G3: briefing `impeccable shape`, validação no navegador e revisão `impeccable`.
  - EVIDENCE: pendente.

## F3. Indicador de modo leitura no shell (Fase G)

**Estado:** não iniciado. Depende do campo `mode` que `IFeatureAccessService` já retorna no PR (ver [03-backend.md](03-backend.md), nó B1).

- [ ] F3.G1: indicador exibido quando `mode === "read_only"`, com explicação da restrição.
  - EVIDENCE: pendente.
- [ ] F3.G2: briefing `impeccable shape`, validação no navegador e revisão `impeccable`.
  - EVIDENCE: pendente.

## F4. Página de assinatura restrita a master e delegados (Fase E)

**Estado:** não verificado. Precisa ler `app/[supabaseId]/subscription/features/container/SubscriptionContainer.tsx` e a rota de `subscription-management`.

- [ ] F4.G1: página oculta para quem não é master nem tem `canManageAccountTeams`, no cliente e na API.
  - EVIDENCE: pendente.
- [ ] F4.G2: briefing `impeccable shape`, validação no navegador e revisão `impeccable`.
  - EVIDENCE: pendente.

## F5. Dialog "Marcar como paga externamente" (Fase D)

**Estado:** não iniciado. Exclusivo do backoffice. Reaproveita o item de menu "Confirmar recebimento em dinheiro" como ponto de entrada.

- [ ] F5.G1: dialog pede referência e comprovante, e chama a rota nova da Fase D.
  - EVIDENCE: pendente.
- [ ] F5.G2: briefing `impeccable shape`, validação no navegador e revisão `impeccable`.
  - EVIDENCE: pendente.

## F6. Padronização visual das ações de fatura (Fase G)

**Estado:** não iniciado. Usa `design-system-guard`.

- [ ] F6.G1: botões de Cancelar e Marcar paga externamente seguem o design system.
  - CHECK: `bun run design:check`
  - EVIDENCE: pendente.

## F7. Tokenização do cartão no checkout de add-on (decisão D1)

**Estado:** decidido, não implementado. Solicitação desta data: apenas documentar.

**Referência já existente no `develop`:** `app/adesao/[token]/features/components/AbacateCardField.tsx`. O componente carrega o `abacatepay.js`, chama `AbacatePay.create` com `onCardChange` (que devolve `canTokenize`) e expõe `tokenize` para o clique. A adesão já envia o `ctok_` ao servidor (`adhesionCheckoutInput.ts`, linha 21).

**Fluxo alvo para o add-on:**
1. O componente monta o formulário do cartão no navegador, com a chave pública (`pk_...`). A chave pública pode ir ao frontend. A chave de API não.
2. O botão "Pagar" fica liberado só quando `canTokenize` é verdadeiro.
3. No clique, o navegador chama `tokenize` e recebe `ctok_...` (60 s, uso único).
4. O navegador envia só o `ctok_` e os dados do cliente ao backend. O número e o CVV nunca passam pelo servidor.
5. O backend chama `/v2/transparents/create` com `method: CARD`, o `ctok_` e o `customer`.
6. O `cardToken` permanente devolvido pelo AbacatePay pode ser salvo para cobrança futura, sem novo pedido do cartão. Esse token não é o número do cartão.

- [ ] F7.G1: formulário do add-on reutiliza `AbacateCardField` e envia só `ctok_`.
  - EVIDENCE: pendente.
- [ ] F7.G2: campo `creditCard` (número e CVV) removido do contrato de `POST /api/v1/addon-checkout/[pendingActionId]/pay`.
  - EVIDENCE: pendente. Ver B3.G6.
- [ ] F7.G3: briefing `impeccable shape`, validação no navegador e revisão `impeccable`.
  - EVIDENCE: pendente.
