# Decisões: assinaturas e add-ons

Registro de decisões desta feature. Substitui a consulta ao Obsidian. Datas de referência: 2026-11-17. Confirmadas pelo usuário na conversa.

Referências: [01-feature.md](01-feature.md) · [02-frontend.md](02-frontend.md) · [03-backend.md](03-backend.md) · [04-progresso.md](04-progresso.md) · [spec-backend.md](spec-backend.md) · [spec-frontend.md](spec-frontend.md)

## D1. Cartão tokenizado no navegador com abacatepay.js

- **Decisão:** o cartão de add-on é tokenizado no navegador com o `abacatepay.js`. O backend recebe só o `ctok_` (60 s, uso único) e chama `/v2/transparents/create` com `method: CARD`.
- **Por quê:** o add-on recebia número e CVV no servidor, o que coloca o servidor no escopo PCI.
- **Referência no develop:** `app/adesao/[token]/features/components/AbacateCardField.tsx`, usado pela adesão.
- **Restrição do provider:** `AbacatePayProvider.createCard` recusa token sem prefixo `ctok_`.
- **Consequências:**
  - o checkout de add-on reutiliza `AbacateCardField`, mantendo o design do checkout existente (`/checkout`) e alterando só o conteúdo de acordo com o produto comprado;
  - o campo `creditCard` saiu do contrato de `POST /api/v1/addon-checkout/[pendingActionId]/pay` (backend concluído em `942e23c8e`);
  - o `cardToken` permanente do AbacatePay pode ser salvo para cobrança futura.
- **Status:** decidido. Backend implementado. Tela pendente, aguardando aprovação do briefing (F7).

## D2. Troca de forma de pagamento só enquanto o pagamento não foi confirmado

- **Decisão:** o cliente pode trocar PIX por cartão, ou cartão por PIX, enquanto a cobrança atual não foi paga. Depois que o pagamento é confirmado, a troca é recusada.
- **Por quê:** o cliente pode escolher PIX e não pagar, e então trocar para cartão. Se já pagou, a troca não pode acontecer.
- **Cancelamento:** o AbacatePay não tem cancelamento para cobrança transparente, só reembolso. Por isso a cobrança anterior não é cancelada na API.
- **Consequências:**
  - `updateBillingType` recusa a troca quando a tentativa atual está `CONFIRMED` (implementado, com 3 testes);
  - `updateBillingType` não cancela a cobrança anterior.
- **Risco residual em aberto:** o cliente pode pagar o PIX no intervalo entre a troca e a expiração. Essa cobrança fica aberta no AbacatePay, e o novo cartão também pode ser cobrado. Decisão pendente: quando um pagamento confirmado chega para uma tentativa substituída, reembolsar automaticamente (usando `/v2/transparents/refund`, que já existe no provider) ou aplicar a ação e reembolsar a cobrança nova. Recomendação: reembolsar automaticamente a tentativa substituída e não aplicar a ação.
- **Status:** decidido para a regra de bloqueio. Implementado. Tratamento da tentativa substituída pendente.

## D3. Cobrança nova de add-on sem fallback para o Asaas

- **Decisão:** toda cobrança nova de add-on (time, usuário e créditos) vai para o AbacatePay, inclusive em conta legada. Não há fallback automático para o Asaas.
- **Por quê:** é a Fase B do plano. Os checkouts da aplicação devem usar o provider AbacatePay.
- **Status:** decidido. Implementado para PIX e cartão com token.

## D4. Diverge da Decisão 13 da spec Pagamentos 2026-10

- **Decisão 13 (spec no Obsidian):** contas legadas ficam na coorte `ASAAS` para manutenção recorrente.
- **Decisão atual:** todo pagamento novo, inclusive de conta legada, vai para o AbacatePay.
- **Por quê:** decisão de produto. O objetivo é que todos os checkouts usem o provider AbacatePay.
- **Consequências:**
  - a spec no Obsidian precisa ser atualizada, mas esta pasta passa a ser a fonte desta feature;
  - a migração recorrente de contas legadas (assinatura e renovação) segue a Fase C.
- **Status:** decidido pelo usuário. Obsidian não atualizado.

## D5. Assinantes com cartão do Asaas recadastram o cartão

- **Decisão:** assinantes que pagam com cartão pelo Asaas perdem o token antigo. Para cobrar add-on pelo AbacatePay, o cliente cadastra o cartão de novo, e o AbacatePay gera um novo `cardToken`.
- **Por quê:** o token do Asaas não é aceito pelo AbacatePay, e o cartão não pode ser transferido entre providers.
- **Consequências:**
  - o caminho que cobrava com o `creditCardToken` do Asaas deixa de existir para add-on;
  - o teste de carência de cartão em `AddOnCheckoutUseCase.cardGuard.test.ts` ainda descreve o comportamento antigo e precisa ser revisado quando a tela de cartão for implementada;
  - a comunicação ao cliente sobre o recadastro precisa ser definida junto com a tela.
- **Status:** decidido pelo usuário em 2026-11-17.

## D6. Parcelamento no cartão limitado pelo ciclo de cobrança

- **Decisão:** o máximo de parcelas no cartão depende do ciclo do contrato, e o cálculo fica em `maxInstallmentsForCycle` (`app/api/services/billing/proportionalAddonCharge.ts`):

| Ciclo (`BackofficeAdhesionBillingCycle` / legado) | Máximo de parcelas |
|---|---|
| monthly (`MONTHLY`) | 1x |
| quarterly (`QUARTERLY`) | 3x |
| quadrimester | 4x |
| semiannual (`SEMIANNUALLY`) | 6x |
| annual (`YEARLY`) | 12x |
| ausente ou desconhecido | 1x |

- **Add-on proporcional:** o máximo é `min(máximo do ciclo, meses restantes do contrato arredondados para baixo)`, piso de 1x. Parcelar além do fim do contrato faria o add-on vencer depois do ciclo.
- **Cobrança avulsa do backoffice:** 1x (decisão do dono em 2026-11-24, tomada sob urgência). Já é o comportamento de `BackofficePaymentUseCase` (`installments: 1`).
- **Validação:** `AddOnCheckoutUseCase.createPayment` rejeita parcelas acima de `payload.maxInstallments`, com mensagem em PT-BR, antes de gravar o aceite e de chamar o provedor.
- **Status:** decidido pelo dono em 2026-11-24.
- **Limite conhecido:** ações pendentes criadas antes desta mudança mantêm o `maxInstallments` antigo no payload (`floor(meses restantes)`) até expirar, que é o TTL de 24 h do checkout.
