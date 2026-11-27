# SPEC de frontend: assinaturas e add-ons

**Estado em 2026-11-26:** T1 e T2 (backoffice), T7 e T8 (regularização do master) entregues na `develop`; T3 e T4 parciais; T5 e T6 não iniciadas. Plano completo em [07-plano-das-fases.md](07-plano-das-fases.md).
**Backend relacionado:** [spec-backend.md](spec-backend.md)
**Notas de implementação e gates:** [02-frontend.md](02-frontend.md)
**Decisões:** [05-decisoes.md](05-decisoes.md) · **Progresso:** [04-progresso.md](04-progresso.md)

Este documento descreve estrutura, regras, interações e estados de cada tela. Não descreve passos de implementação.

Regra de processo: toda tela passa pelo briefing `impeccable shape` antes do JSX, com aprovação. Depois de implementada, passa pela revisão `impeccable`. Nenhuma tela é reportada como pronta sem as duas etapas e a verificação no navegador.

## Índice de telas

| Tela | Onde | Estado |
| --- | --- | --- |
| T1. Badge de acesso | Backoffice, detalhe do cliente | Implementada e mergeada (PR #1381) |
| T2. Cancelar fatura | Backoffice, aba Faturas | Implementada e mergeada (PR #1381) |
| T3. Pagamento de add-on com cartão | Checkout de add-on | Parcial: checkout oferece cartão com a chave pública do AbacatePay. Tokenização real não verificada |
| T4. Indicador de modo leitura | Shell do Corretor Studio | Parcial: `ReadOnlyAccessBanner` no shell. Faltam botões de escrita desabilitados com explicação |
| T5. Marcar como paga externamente | Backoffice, aba Faturas | Não iniciada |
| T6. Página de assinatura | Corretor Studio, assinatura | Não iniciada |
| T7. Botão "Regularizar assinatura" | Painel "Acesso não liberado" | Implementada (D18) |
| T8. Checkout em tela própria e confirmação | `/pagamento/[supabaseId]` e `/addon-checkout/[pendingActionId]` | Implementada (D15, D16 e D17) |

## T1. Badge de acesso (backoffice)

**Onde:** detalhe do cliente no backoffice, `app/backoffice/(app)/clients/[masterId]/features/container/BackofficeClientDetailsContainer.tsx`.

**Objetivo:** mostrar se a conta tem acesso total, acesso de leitura ou nenhum acesso, considerando a carência.

**Estados do badge:**
- **Acesso total:** conta com assinatura ativa, Member PRO ativo ou cota permanente.
- **Acesso (leitura):** conta em carência expirada, com `past_due` dentro da janela de leitura.
- **Sem acesso:** conta suspensa, cancelada, banida ou bloqueada.

**Regras:**
- O estado vem do resolver do backend (`resolveBackofficeAccessMode`). A tela não calcula acesso.
- Conta banida ou com Member PRO bloqueado mostra "Sem acesso", mesmo com data de vencimento futura.

**Estado de implementação:** o rótulo "Acesso (leitura)" está presente. Não foi confirmado que "Acesso total" e "Sem acesso" aparecem nesse container.

**Pendências:** verificar os três rótulos na tela, testar no navegador em desktop e mobile, e aplicar a revisão `impeccable`.

## T2. Cancelar fatura (backoffice)

**Onde:** aba Faturas do mesmo container.

**Objetivo:** permitir cancelar uma fatura que ainda não foi paga.

**Regras de exibição:**
- O botão aparece só quando a fatura não é `adhesion_external`, não está paga e não está `WAIVED`.
- O botão aparece na linha da tabela, com estilo destrutivo discreto.

**Interação:**
1. Clique em "Cancelar" abre um `AlertDialog` com o título "Cancelar esta fatura?".
2. O dialog tem as ações "Voltar" e "Cancelar fatura".
3. Durante a chamada, o botão mostra "Cancelando..." e fica desabilitado.
4. Em sucesso, a tabela é atualizada. Em erro, o dialog mostra a mensagem do servidor.

**Estado de implementação:** botão, condição de exibição e dialog mergeados (PR #1381). A regra de exibição tem teste (`features/utils/invoiceActions.test.ts`, presente na `develop`); o botão no navegador: Não verificado.

**Pendências:** teste do botão no navegador, `impeccable`.

## T3. Pagamento de add-on com cartão

**Onde:** checkout de add-on, `/addon-checkout`, que já usa `PublicCheckoutFlow`.

**Objetivo:** cobrar o cartão sem que o número e o CVV passem pelo servidor (D1).

**Estrutura:**
- Campo do cartão montado pelo `abacatepay.js`, com a chave pública. Reutiliza `AbacateCardField`, já usado na adesão.
- Botão "Pagar" desabilitado até `canTokenize` ser verdadeiro.
- Dados do cliente: nome, e-mail, CPF/CNPJ e celular.

**Interação:**
1. O campo do cartão carrega. Enquanto isso, o botão fica desabilitado.
2. Ao preencher, `onCardChange` atualiza `canTokenize`.
3. No clique, o navegador chama `tokenize` e recebe `ctok_`.
4. O navegador envia só o `ctok_` e os dados do cliente ao backend.
5. Em sucesso, a tela mostra o status da cobrança. Em erro, mostra a mensagem e reabilita o botão se o formulário ainda estiver válido.

**Estados:**
- Carregando o campo do cartão.
- Cartão incompleto ou inválido: botão desabilitado, sem mensagem de erro até o clique.
- Erro de 3DS, de rede ou da API: mensagem clara, sem perder os dados do cliente.
- Sucesso: aguardando confirmação, com polling de status.

**Estado de implementação (2026-11-26):** parcial. O backend recebe só o `ctok_` (`942e23c8e`) e o checkout de add-on passa a chave pública do AbacatePay e os métodos disponíveis ao `PublicCheckoutFlow` (`AddOnCheckoutContainer.tsx`); há cenários E2E de cartão em `e2e/specs/checkout/addon-checkout.spec.ts`. Tokenização real contra o AbacatePay e o gate F7 de [02-frontend.md](02-frontend.md): Não verificado.

## T4. Indicador de modo leitura (shell)

**Onde:** shell do Corretor Studio, em todas as telas autenticadas.

**Objetivo:** avisar que a conta está em modo leitura e explicar que escrita está bloqueada.

**Regras:**
- Aparece só quando o `mode` retornado por `FeatureAccessService` for `read_only`.
- Botões de escrita ficam desabilitados, com explicação ao passar o cursor ou focar.

**Estado de implementação (2026-11-26):** parcial. `ReadOnlyAccessBanner` (`app/[supabaseId]/components/ReadOnlyAccessBanner.tsx`) já aparece no shell quando a decisão de acesso é `read_only`, com o botão de regularizar para o master; ele lê `accountAccessDecision`, não o campo `mode` da A1. Falta desabilitar botões de escrita com explicação.

**Pendências:** briefing e implementação dos botões desabilitados, teste de navegação e revisão `impeccable`. Fase G.

## T5. Marcar como paga externamente (backoffice)

**Onde:** aba Faturas. Reaproveita o item de menu "Confirmar recebimento em dinheiro" como ponto de entrada.

**Objetivo:** registrar baixa manual de fatura, com comprovante.

**Interação:**
1. O dialog pede referência e comprovante. O comprovante é opcional, mas a referência é obrigatória.
2. Após confirmar, a fatura muda para paga com a marca de baixa externa.

**Regras:** só para fatura pendente. Não reaproveita o waive.

**Estado de implementação:** não iniciada. O ponto de entrada existe: o item de menu "Confirmar recebimento em dinheiro" está em `app/backoffice/(app)/clients/[masterId]/invoices/[invoiceId]/features/container/BackofficeClientInvoiceDetailsContainer.tsx` (linha 354) e hoje não grava a baixa externa.

## T6. Página de assinatura

**Onde:** `app/[supabaseId]/subscription/features/container/SubscriptionContainer.tsx`.

**Regras:**
- Visível só para `isMaster` ou `canManageAccountTeams`.
- Para os demais, a página não aparece no menu e uma tentativa direta mostra mensagem de acesso restrito.
- A API também nega a esses usuários (R6, ver [spec-backend.md](spec-backend.md)).

**Estado de implementação:** não iniciada. Nenhuma rota de `app/api/v1/subscription-management/` nem o `SubscriptionContainer.tsx` usa `hasDelegatedTeamManagementAccess` (`git grep` em `HEAD`, 2026-11-26).

## T7. Botão "Regularizar assinatura" no painel "Acesso não liberado"

**Onde:** painel central quando a rota exige um módulo que o usuário não tem. Componente `app/[supabaseId]/components/FeatureBlockedPanel.tsx`, usado em `LayoutContent.tsx`.

**Objetivo:** dar ao master um caminho para pagar quando o bloqueio vem de assinatura em carência ou somente leitura.

**Regras:**
- O botão aparece só para o master com cobrança pendente (carência ativa ou `read_only`). Regra: `canOfferPaymentFromBlockedFeature`.
- Sem cobrança pendente, ou para quem não é master, o painel segue só com o texto.

**Interações:** o clique leva a `/pagamento/[supabaseId]`.

**Estados:** master com pendência (botão), master sem pendência (sem botão), membro (sem botão).

**Estado de implementação:** implementada (`039ba5d15`, D18). Briefing: [design/regularizar-assinatura-painel-bloqueado.md](design/regularizar-assinatura-painel-bloqueado.md). Testes: `FeatureBlockedPanel.test.tsx`. Vista no navegador em 1280 e 375 px.

**Pendências:** revisão `impeccable` completa, leitor de tela, WebKit.

## T8. Checkout em tela própria e confirmação com contador

**Onde:** `/pagamento/[supabaseId]` (regularização) e `/addon-checkout/[pendingActionId]` (add-on).

**Objetivo:** tirar o checkout do shell da conta, mantendo o usuário logado, e levá-lo de volta ao app depois do pagamento.

**Regras:**
- Sem sidebar. Cabeçalho com logo, "Corretor Studio" e "Sair" (`components/checkout/CheckoutAccountHeader.tsx`). O add-on manteve o cabeçalho do `PublicCheckoutShell`.
- Exige sessão. Sem sessão, vai ao login e volta para a mesma URL. Na regularização, só o dono da conta vê o checkout.
- A rota antiga `/[supabaseId]/billing-grace-payment` responde 308 para a nova.

**Interações:** depois do pagamento confirmado, a tela mostra "Assinatura reativada" (renovação) ou "Pagamento confirmado" (add-on), "Você será levado ao Corretor Studio em N s." e o botão "Ir agora". Em 5 s, navega para `/[supabaseId]/dashboard`. Não há botão de cancelar (D17).

**Estados:** carregando, cotação, erro de cotação, pagamento recusado, PIX expirado, sucesso.

**Estado de implementação:** implementada (D15, D16 e D17; commits `1e6a8a88c`, `572020153`, `38595f69a`; PR #1431). Briefing: [design/checkout-pagamento-dedicado.md](design/checkout-pagamento-dedicado.md). Regularização vista no navegador em desktop e 375 px, com pagamento simulado.

**Pendências:** confirmação do add-on com pagamento confirmado de verdade, cabeçalho com "Sair" no add-on, WebKit e leitor de tela.

## Requisitos comuns

- Textos em PT-BR, sem Title Case nos títulos.
- Valores em reais e datas no fuso do usuário.
- Layout funciona a partir de 375 px, sem rolagem horizontal.
- Tokens de design do projeto. `bun run design:check` precisa passar em telas novas.
