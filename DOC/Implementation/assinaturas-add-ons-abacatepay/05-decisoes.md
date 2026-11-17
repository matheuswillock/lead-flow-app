# Decisões: assinaturas e add-ons

Registro de decisões desta feature. Substitui a consulta ao Obsidian. Data de referência: 2026-11-17. Confirmadas pelo usuário na conversa desta data.

Referências: [01-feature.md](01-feature.md) · [02-frontend.md](02-frontend.md) · [03-backend.md](03-backend.md) · [04-progresso.md](04-progresso.md)

## D1. Cartão tokenizado no navegador com abacatepay.js

- **Decisão:** o cartão de add-on é tokenizado no navegador com o `abacatepay.js`. O backend recebe só o `ctok_` (60 s, uso único) e chama `/v2/transparents/create` com `method: CARD`.
- **Por quê:** hoje o add-on recebe `creditCard` com número e CVV no servidor (`app/api/useCases/addOnCheckout/AddOnCheckoutUseCase.ts`, linha 214). Isso coloca o servidor no escopo PCI. O fluxo de tokenização evita esse problema.
- **Referência no develop:** `app/adesao/[token]/features/components/AbacateCardField.tsx`, usado pela adesão, que já envia `ctok_`.
- **Restrição do provider:** `AbacatePayProvider.createCard` recusa token que não comece com `ctok_` e token com mais de 60 s.
- **Consequências:**
  - o checkout de add-on passa a reutilizar `AbacateCardField`;
  - o campo `creditCard` sai do contrato de `POST /api/v1/addon-checkout/[pendingActionId]/pay`;
  - o `cardToken` permanente devolvido pelo AbacatePay pode ser salvo para cobrança futura, sem novo pedido do cartão.
- **Status:** decidido em 2026-11-17. Não implementado. A implementação fica para a próxima rodada, por pedido explícito de não atualizar código agora.

## D2. Troca de forma de pagamento cancela a cobrança anterior, nos dois sentidos

- **Decisão:** ao trocar PIX por cartão, ou cartão por PIX, a cobrança aberta anterior é cancelada no AbacatePay antes da nova ser criada.
- **Por quê:** evita cobrança dupla. Sem o cancelamento, o cliente pode pagar o PIX depois de já ter pago pelo cartão.
- **Consequências:** `updateBillingType` precisa cancelar pela tentativa atual (`providerAttemptId`). Hoje ele não cancela cobrança AbacatePay (ver [03-backend.md](03-backend.md), B5).
- **Status:** decidido em 2026-11-17. Não implementado.

## D3. Cobrança nova de add-on sem fallback para o Asaas

- **Decisão:** toda cobrança nova de add-on (time, usuário e créditos) vai para o AbacatePay, inclusive em conta legada. Não há fallback automático para o Asaas.
- **Por quê:** é a Fase B do plano. Os checkouts da aplicação devem usar o provider AbacatePay.
- **Consequências:** o cartão de add-on depende de D1. Até D1 estar implementada, cartão de add-on fica indisponível.
- **Status:** decidido.

## D4. Diverge da Decisão 13 da spec Pagamentos 2026-10

- **Decisão 13 (spec no Obsidian):** contas legadas ficam na coorte `ASAAS` para manutenção recorrente.
- **Decisão atual:** todo pagamento novo, inclusive de conta legada (exemplo: You Pop Corretora de Seguros), vai para o AbacatePay.
- **Por quê:** decisão de produto desta conversa. O objetivo é que todos os checkouts usem o provider AbacatePay.
- **Consequências:**
  - a spec no Obsidian precisa ser atualizada, mas esta pasta passa a ser a fonte desta feature;
  - a migração recorrente de contas legadas (assinatura e renovação) segue a Fase C. O plano para essa etapa ainda não está definido.
- **Status:** decidido pelo usuário. Obsidian não atualizado.
