# Decisões: assinaturas e add-ons

Registro de decisões desta feature. Substitui a consulta ao Obsidian. Datas de referência: 2026-11-17 a 2026-11-26. Confirmadas pelo usuário na conversa.

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

## D7. Renovação registrada no ledger de regularização

- **Decisão:** a cobrança de uma renovação é uma linha de `billing_grace_payments`, criada quando o master paga na página de pagamento, com chave de idempotência por tentativa. A unicidade `(conta, chave)` do ledger impede a mesma tentativa de cobrar duas vezes.
- **Por quê:** a tabela já tem a unicidade, o vínculo com sessão e tentativa do provedor, e a conclusão que avança o vencimento. Uma tabela nova duplicaria isso.
- **Aceite dos termos:** no checkout, para pagar, o cliente precisa aceitar os termos, e esse aceite é a assinatura do contrato. A página de pagamento envia `termsAccepted` e a linha grava `termsAcceptedAt` e a versão dos termos.
- **Como o checkout bloqueia:** a autoridade é o servidor. O contrato de `IBackofficeAdhesionService` exige `termsAccepted: true`, e a adesão grava `termsAcceptedAt` e a versão. No `/checkout` (contratação) o botão de pagar agora fica **desabilitado** enquanto a caixa dos termos estiver desmarcada (desktop e última fase no celular), com o motivo à vista; "Continuar" nas fases intermediárias segue livre, e no retry de pagamento (pedido já criado) a caixa some e nada é exigido de novo. A validação no envio continua como rede de proteção. Briefing em [design/checkout-aceite-termos.md](design/checkout-aceite-termos.md), registro do gate em [02-frontend.md](02-frontend.md) (F11).
- **Escopo:** só o `/checkout`, que é onde a caixa existe. Renovação, add-on e adesão continuam com o aviso implícito "Ao pagar, você concorda" e sem bloqueio; estender a caixa a eles seria outra decisão.
- **Status:** decidido pelo usuário em 2026-11-25; botão desabilitado implementado em 2026-11-26.

## D8. Renovação é reativa: sem cobrança antecipada (substitui a versão do cron de D-5)

- **Decisão:** a renovação segue o fluxo que o produto já tem. O ciclo vence, a conta passa pela carência (`BILLING_GRACE_DAYS`, 5 dias) e depois fica somente leitura. Em qualquer momento o master abre a página de pagamento (`/pagamento/[supabaseId]`, antes `/billing-grace-payment`), escolhe o prazo (mensal, trimestral, semestral ou anual) com os preços do backoffice e paga. Não há PIX criado antes do vencimento e não há cron de renovação.
- **Por quê:** o dono do produto definiu a renovação assim em 2026-11-25. A versão anterior desta decisão (cron criando o PIX do ciclo em D-5) partia de uma leitura do item M13 que não era a pretendida, e foi removida (cron, cobrador, caso de uso e composição).
- **Falha do provedor:** a regularização é iniciada pelo próprio master, na tela, com chave de idempotência por tentativa. Uma falha aparece para ele na hora e ele tenta de novo. Não há cobrança automática a duplicar.
- **Status:** decidido em 2026-11-25. Substitui a decisão anterior de mesmo número.

## D9. Provedor da linha vem do roteador

- **Decisão:** a coluna `provider` do ledger e a marcação da assinatura recebem a chave escolhida por `router.select`, não um nome fixo.
- **Por quê:** a regra de pagamento agnóstico proíbe nomear o provedor fora dos adaptadores e dos registros.
- **Feito:** o `BillingGracePaymentService` deixou de gravar o literal `ABACATE_PAY` e grava `selected.provider`. O arquivo ainda importa `createAbacatePayProvider` da composição, que é o registro permitido.
- **Status:** resolvido em 2026-11-25.

## D10. Corte do Asaas quando a renovação é paga pelo roteador

- **Decisão:** a conta legada (`provider` nulo, com `asaasSubscriptionId`) que paga a renovação pelo roteador tem a assinatura recorrente cancelada no Asaas e a conta marcada com o provedor que recebeu o pagamento (a coluna `provider` da linha do ledger, sem nome fixo). O `asaasSubscriptionId` é mantido como trilha de auditoria.
- **Quando:** na confirmação do pagamento, nos dois pontos em que ela acontece. No webhook (`PaymentOwnerSettlementService`), logo depois de concluir a regularização. No cartão aprovado na hora (`BillingGracePaymentService`), em melhor esforço.
- **Retomada:** se o cancelamento ou a marcação falhar no webhook, o erro propaga e o evento é reentregue. Na reentrega com a regularização já concluída o serviço não renova de novo, mas repete o corte (idempotente: conta que já saiu do Asaas não faz nada, assinatura já removida no Asaas conta como cancelada).
- **Onde está o id (revisão do PR #1432):** o id da assinatura do Asaas pode estar só no perfil, o mesmo fallback que o sync do Asaas aceita. A busca resolve o par (id, conta) da mesma linha, com a assinatura vencendo o perfil. Conta que só tem o id no perfil não tem linha de assinatura; ao marcar o provedor a linha nasce espelhando o perfil (status, vencimento, prazo e o ponteiro do Asaas como auditoria), porque o provedor é o sinal que o sync usa.
- **Sync do Asaas ignora conta roteada (revisão do PR #1432):** o id fica guardado para auditoria, mas `syncFromAsaas` não consulta conta com provedor do roteador. O Asaas devolveria a assinatura cancelada como inativa, e isso viraria `canceled` por cima do pagamento confirmado.
- **Por quê:** sem o corte, o Asaas pode cobrar de novo o mesmo ciclo que o cliente acabou de pagar pelo roteador.
- **Webhook:** `SUBSCRIPTION_DELETED` do Asaas só invalida o cache de acesso da conta em `processAsaasWebhookEvent`, e não revoga o acesso.
- **Consequência de produto:** quem pagava com cartão recorrente no Asaas passa a renovar manualmente (PIX ou cartão na página de pagamento) até recadastrar o cartão (D5).
- **Premissa conferida na documentação do Asaas (FAQ de Assinaturas):** o `DELETE` da assinatura encerra a recorrência e remove as cobranças pendentes ou vencidas dela. O Asaas gera cada cobrança da assinatura 40 dias antes do vencimento por padrão, então o cancelamento na confirmação do pagamento é o que impede a cobrança em duplicidade. Falta confirmar no sandbox do Asaas, que não foi executado.
- **Status:** decidido em 2026-11-25 (substitui o corte no D-5).

## D11. Kill switch liga só o corte do Asaas

- **Decisão:** `PAYMENT_PROVIDER_RENEWAL_ENABLED` (`lib/payment-provider/renewal-kill-switch.ts`) é o ponto único que liga o corte do D10. Só o valor `true` liga. Desligado (padrão), o pagamento da renovação pelo roteador continua funcionando normalmente e o Asaas não é tocado.
- **Por quê:** o corte cancela uma assinatura em produção com base numa premissa ainda não verificada no sandbox (D10). Quem liga é o dono, depois de verificar.
- **Divergência do pedido original:** o pedido original falava em desligar "só a renovação do AbacatePay". A renovação reativa já roda em produção e não passa por esta chave, para não derrubar um fluxo que funciona. A chave ficou restrita ao único comportamento novo e irreversível: cancelar o Asaas.
- **Status:** decidido em 2026-11-25.

## D12. E-mail da carência: dois avisos, com link para a página de pagamento

- **Decisão:** o cron `overdue-reminder` (já existente) ganhou um passo antes dos degraus: envia ao master, durante a carência, dois avisos de que o ciclo está se encerrando. O primeiro sai quando a conta é vista como `past_due` (dias 0 a 3 de atraso). O segundo sai no último dia antes do modo somente leitura (dia 4). Cada aviso tem a data limite da carência e o botão para a página de pagamento (`/pagamento/[supabaseId]`; antes da D15 era `/billing-grace-payment`).
- **Dedupe:** um aviso por ciclo de atraso, gravado em `SubscriptionChangeLog` com `eventType` nulo e `changeType` próprio (`delinquency_grace_started`, `delinquency_grace_last_day`). Fica nulo para não contar como transição "overdue" nas métricas de ciclo de vida. Sem migration.
- **Regra dos dias:** `resolveGraceNotice` em `lib/billing/delinquency-tier.ts`. Não altera `resolveDelinquencyTier` nem o acesso.
- **Texto:** `lib/billing/delinquency-reminder-copy.ts`. Cita os prazos (mensal, trimestral, semestral ou anual) e que usuários e times adicionais aparecem antes de pagar.
- **Dependência:** os avisos dependem do status `past_due`, o mesmo que define a carência (`resolveBillingGraceUntil`). Para contas do roteador, quem marca `past_due` é o D14.
- **Status:** decidido em 2026-11-25. Dias confirmados pelo dono.

## D14. Conta do roteador vira `past_due` por data (cron `subscription-overdue-transition`)

- **Achado:** só o webhook `PAYMENT_OVERDUE` do Asaas, a sincronização com o Asaas e o Member PRO marcavam `past_due`. Conta paga pelo roteador ficava `active` depois do vencimento, e `AccountAccessDecisionService` manda `active` com vencimento passado direto para `restricted`: sem carência, sem aviso, sem somente leitura.
- **Decisão:** cron diário `/api/v1/billing/cron/subscription-overdue-transition` (06:30 UTC, antes do `overdue-reminder`) marca `past_due` a assinatura `active` com `provider` preenchido cujo vencimento passou (mesma regra de data do acesso, `lib/billing/due-date.ts`), grava `overdue` na linha do tempo e deixa a carência e os avisos do D12 funcionarem.
- **Vencimento efetivo (revisão do PR #1432):** a listagem e a comparação usam o mais antigo entre a assinatura e o perfil, o mesmo que a decisão de acesso usa (`resolveEffectiveNextDueDate`). Antes só a data da assinatura contava, e conta com o perfil mais antigo ficava restrita sem passar por `past_due`, sem carência e sem aviso.
- **Janela estreita:** só contas vencidas dentro da carência (5 dias). Quem venceu antes já está bloqueado e continua assim: não é reaberto para somente leitura nem recebe uma onda de e-mails de corte na primeira execução.
- **Segurança:** `markPastDueIfStillDue` só muda a conta se ela continua `active` com o mesmo vencimento, então um pagamento que avançou o vencimento no meio do caminho não é revertido. Idempotente.
- **Escopo:** só contas com `provider` preenchido (roteador). Conta legada com assinatura no Asaas continua marcada pelo Asaas até o corte do D10.
- **Efeito de produto a revisar:** contas do roteador vencidas há 1 a 5 dias passam a ter carência e somente leitura em vez de `restricted` imediato. É o comportamento pedido (carência, depois somente leitura), mas muda o acesso de quem hoje cai direto em `restricted`.
- **Status:** decidido em 2026-11-25.

## D13. Renovação com usuários e times adicionais; prazo anterior pré-selecionado

- **Já existe:** a cotação de cada prazo soma plano, usuários adicionais (mensalidade vezes meses) e times adicionais (preço único do período); o anual inclui usuários ilimitados e não cobra por usuário. A tela lista cada usuário e time, deixa desmarcar quem não continua e já pré-seleciona o prazo anterior da conta.
- **Corrigido (servidor):** conta legada guardava `YEARLY` ou `SEMIANNUALLY` e abria no primeiro prazo da lista. A cotação devolve o prazo normalizado (`annual`, `semiannual`), então o pré-selecionado funciona para todas as contas.
- **Tela:** aviso a quem perde o ilimitado ao sair do anual, com os valores, controle "Manter usuários ilimitados (plano anual)" e linha "Inclui R$ X de usuários adicionais" em cada prazo. Briefing [aprovado em 2026-11-25](design/renovacao-usuarios-adicionais.md). Implementada; falta a verificação renderizada.
- **Status:** decidido em 2026-11-25.

## D15. Checkout de regularização em tela própria, fora do shell da conta

- **Problema:** a regularização abria dentro do layout da conta (com sidebar), como se o master estivesse usando o app. Para quem está pagando, isso mistura navegação do produto com um fluxo de cobrança.
- **Decisão:** o checkout de regularização mora em `/pagamento/[supabaseId]`, num layout próprio (`app/pagamento/[supabaseId]/layout.tsx`) com cabeçalho enxuto (logo e "Sair") e sem sidebar. O usuário continua logado: a rota exige sessão e só o dono da conta (o `supabaseId` da URL igual ao usuário logado) vê o checkout; os demais voltam ao próprio dashboard.
- **Rota antiga:** `/[supabaseId]/billing-grace-payment` responde 308 para `/pagamento/[supabaseId]` (`resolveLegacyBillingGracePaymentPath`, aplicado em `proxy.ts`). Os links do banner, do painel, do modo leitura, da página de assinatura e do e-mail de inadimplência apontam para a rota nova.
- **Sessão no servidor:** o helper `getServerSessionUserId` (`lib/supabase/server-session-user.ts`) resolve o usuário como o bootstrap da conta faz, aceitando também o cookie assinado do E2E. Sem ele, a página mandava o E2E ao login.
- **Briefing:** [design/checkout-pagamento-dedicado.md](design/checkout-pagamento-dedicado.md), aprovado pelo dono em 2026-11-26 (rota `/pagamento/[supabaseId]`).
- **Status:** decidido e implementado em 2026-11-26 (`1e6a8a88c`, `572020153`, `38595f69a`; PR #1431).

## D16. Checkout de add-on exige login

- **Decisão:** `/addon-checkout/[pendingActionId]` deixou de ser público. O proxy trata `/addon-checkout/` e `/pagamento/` como páginas de sessão obrigatória (`SESSION_REQUIRED_PAGE_PREFIXES` em `lib/proxy/route-access.ts`); sem sessão, vai para `/sign-in?next=<caminho>` e volta para a mesma URL.
- **Limite conhecido:** a proteção é da página. A API `/api/v1/addon-checkout/[pendingActionId]` continua acessível pelo id da cobrança, como antes. Exigir que o usuário pertença ao time da cobrança na API é um endurecimento à parte, que não foi feito.
- **Efeito:** o E2E do add-on precisa da sessão de teste (`injectE2eAuthCookie`).
- **Cabeçalho:** o add-on manteve o cabeçalho do `PublicCheckoutShell`. O cabeçalho com "Sair" não foi adicionado ali, porque ficava duplicado e com o botão ilegível sobre o fundo claro. Pendência de produto.
- **Status:** decidido pelo dono em 2026-11-26; implementado na página e no proxy. API: pendente.

## D17. Confirmação final com contador de 5 segundos, sem cancelar

- **Decisão:** depois do pagamento confirmado, a tela de sucesso (renovação "Assinatura reativada" e add-on "Pagamento confirmado") mostra "Você será levado ao Corretor Studio em N s." e o botão "Ir agora". O redirecionamento usa navegação completa, para o dashboard recalcular o acesso já pago. Componente: `components/checkout/CheckoutAutoRedirect.tsx`.
- **Sem cancelar:** a primeira versão tinha um botão "Cancelar" e uma mensagem de redirecionamento cancelado. O dono pediu para retirar em 2026-11-26.
- **Destino:** `/[supabaseId]/dashboard`. O briefing aprovado dizia "entrada da conta (`/[supabaseId]`)", mas essa raiz não tem página e daria 404. O dashboard é o destino que a tela de renovação já usava.
- **Status:** decidido e implementado em 2026-11-26. Não verificado: confirmação do add-on com pagamento confirmado de verdade (só a renovação foi vista, com o pagamento simulado no navegador).

## D18. Botão "Regularizar assinatura" no painel "Acesso não liberado"

- **Problema:** o painel de bloqueio por falta de módulo não oferecia caminho para o master pagar, mesmo quando a causa era a assinatura em carência ou somente leitura.
- **Decisão:** o painel (`FeatureBlockedPanel`) mostra o botão "Regularizar assinatura" só quando o usuário é o master e a conta tem cobrança pendente (carência ativa ou `read_only`). A regra é `canOfferPaymentFromBlockedFeature` (`app/[supabaseId]/components/accountAccessRecovery.ts`). Sem cobrança pendente, ou para quem não é master, o painel segue só com o texto.
- **Briefing:** [design/regularizar-assinatura-painel-bloqueado.md](design/regularizar-assinatura-painel-bloqueado.md), aprovado pelo dono em 2026-11-25.
- **Status:** decidido e implementado em 2026-11-25 (`039ba5d15`).
