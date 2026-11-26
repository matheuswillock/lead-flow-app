# Assinaturas e add-ons: cobrança AbacatePay, acesso e gestão de faturas

- Status geral em 2026-11-26: fases A, B e C entregues e mergeadas na `develop`; D, E, F e G pendentes. Detalhe em [04-progresso.md](04-progresso.md) e o plano completo em [07-plano-das-fases.md](07-plano-das-fases.md).
- PRs: Fase A [#1381](https://github.com/matheuswillock/lead-flow-app/pull/1381) (2026-11-18); Fase B #1408, #1413, #1414 e [#1431](https://github.com/matheuswillock/lead-flow-app/pull/1431) (2026-11-18 a 2026-11-26); Fase C [#1432](https://github.com/matheuswillock/lead-flow-app/pull/1432) (2026-11-26). Base `develop`.
- Prazo da Fase A: 2026-11-19
- Frontend: [02-frontend.md](02-frontend.md) · Backend: [03-backend.md](03-backend.md)

## Por que a feature existe

1. **Acesso indevido em carência.** Contas em carência sem Member PRO ficam bloqueadas por completo (leitura e escrita). O correto é manter acesso total durante a vigência e cair para leitura em tudo que a conta já contratou depois da carência. Exemplo observado: a conta You Pop Corretora de Seguros. O PR #1395 corrigiu o caso Member PRO + CRM, mas o problema geral continua.
2. **Cobrança nova ainda vai para o Asaas.** Add-ons (time, usuário/licença, créditos) e assinatura precisam migrar para o AbacatePay, sem fallback para o Asaas, inclusive em contas legadas.
3. **Backoffice sem gestão de faturas.** Faltam as ações "Cancelar" e "Marcar como paga externamente" nas faturas pendentes. Essas ações nunca aparecem para o cliente final.
4. **Página de assinatura aberta a qualquer usuário.** Deve ficar restrita a master e delegados.

## O que a feature implementa

| Fase | Escopo | Corte 19/11 | Estado no PR/branch |
|---|---|---|---|
| A | Acesso em carência: liberação genérica por contrato, badge tri-estado do backoffice, botão "Cancelar" fatura | sim | implementada e mergeada na `develop` (PR #1381, 2026-11-18) |
| B | Add-ons (time, usuário, créditos) e cobrança avulsa do backoffice cobrados pelo AbacatePay | não | implementada e mergeada (PRs #1408, #1413, #1414 e #1431), sem sandbox |
| C | Renovação reativa pelo roteador: e-mail dos dois avisos da carência, `past_due` por data para contas do roteador, corte do Asaas na confirmação do pagamento, aviso de perda do ilimitado na tela de renovação (o cron de renovação antecipada foi removido, D8) | não | implementada e mergeada (PR #1432, 2026-11-26), sem sandbox. Ver [06-fase-c-renovacao.md](06-fase-c-renovacao.md) |
| A e C | Regularização do master: botão no painel "Acesso não liberado", checkout em tela própria `/pagamento/[supabaseId]`, add-on com login, confirmação com contador de 5 s | não | implementada e mergeada (commits `039ba5d15`, `1e6a8a88c`, `572020153`, `38595f69a`; PR #1431). Ver D15 a D18 |
| D | "Marcar como paga externamente" com comprovante (só backoffice) | não | não iniciada |
| E | Página de assinatura restrita a master ou delegado | não | não iniciada: nenhuma rota de `subscription-management` usa `hasDelegatedTeamManagementAccess` |
| F | Alertas de inadimplência: verificar destinatário e fechar BILLING-GRACE-T002 | não | parcial: os dois avisos da carência foram feitos na Fase C (D12). Falta confirmar o destinatário e os degraus de janela fixa (ver riscos) |
| G | Indicador de modo leitura no shell; padronização visual das ações de fatura | não | parcial: `ReadOnlyAccessBanner` já aparece no shell em modo leitura. Faltam desabilitar botões de escrita com explicação e padronizar as ações de fatura |

## Decisões fechadas

- Ações de fatura (cancelar, marcar paga externamente) existem só no backoffice.
- Migração de provider em duas etapas: add-ons primeiro (B), assinatura por último (C, maior risco financeiro).
- "Marcar como paga externamente" usa campo novo e separado do waive. Não reutiliza `forceApplyPendingActionWithoutCharge`.
- Add-ons são time, usuário/licença e créditos. Não existe categoria separada de funcionalidades.
- Fase A libera leitura em tudo que o time já tinha contratado, sem lista fixa de módulos.
- Página de assinatura usa `isMaster || canManageAccountTeams`, sem campo novo em `TeamMember`.
- Indicador de modo leitura no front fica para a Fase G, depois de 19/11.
- Toda tela afetada passa pelo briefing `impeccable shape` antes do JSX e pela revisão `impeccable` depois da implementação.

### Decisões confirmadas em 2026-11-17

Detalhe em [05-decisoes.md](05-decisoes.md).

- **D1, cartão tokenizado no navegador.** O cartão de add-on será tokenizado com `abacatepay.js`, e o servidor recebe só o `ctok_`. Hoje o cartão de add-on está bloqueado no código, e só PIX funciona.
- **D2, troca de forma de pagamento cancela a cobrança anterior**, nos dois sentidos (PIX para cartão e cartão para PIX).
- **D3, sem fallback para o Asaas** em cobrança nova de add-on.
- **D4, divergência da Decisão 13 da spec antiga.** Todo pagamento novo, inclusive de conta legada, vai para o AbacatePay.

Mudança de código que a B-1 fez e que não foi decidida antes: a recusa de cartão com assinatura legacy saiu do fluxo de add-on, porque a cobrança agora é no AbacatePay. Os testes foram reescritos para esse contrato.

### Decisões confirmadas em 2026-11-25 e 2026-11-26

Detalhe em [05-decisoes.md](05-decisoes.md). D5 a D14 vêm da Fase B e da Fase C; D15 a D18 são da regularização do master.

- **D15, checkout de regularização em tela própria.** `/pagamento/[supabaseId]`, fora do shell da conta, com login e dono da conta. A rota antiga redireciona (308).
- **D16, checkout de add-on exige login.** A API continua acessível pelo id da cobrança; endurecer por time é pendência.
- **D17, confirmação final com contador de 5 s, sem cancelar,** para `/[supabaseId]/dashboard` (a raiz `/[supabaseId]` não tem página).
- **D18, botão "Regularizar assinatura" no painel "Acesso não liberado"** só para o master com cobrança pendente.

## Fora de escopo

- Migração de dados de produção.
- Aplicação de migrations em qualquer banco. A aplicação segue o fluxo da pipeline após o merge na develop.
- Deploy e cobrança real na AbacatePay (sandbox fica para validação manual).

## Riscos

- **Cartão de add-on (reavaliado em 2026-11-26).** O risco de indisponibilidade e de dado sensível no servidor era anterior à D1. O backend recebe só o `ctok_` (`942e23c8e`), o checkout de add-on já oferece cartão com a chave pública do AbacatePay (`abacatePublicKey` em `AddOnCheckoutContainer.tsx`) e há cenários E2E de cartão em `e2e/specs/checkout/addon-checkout.spec.ts`. O gate F7 do `02-frontend.md` ainda não foi atualizado e a tokenização real contra o AbacatePay: Não verificado.
- **Contas legadas sem `subscriptionNextDueDate`** continuam sem carência. Volume real em produção não foi medido.
- **Decisão 13 da spec antiga diverge** da decisão atual (todo pagamento novo vai para o AbacatePay). A spec no Obsidian ainda não foi atualizada, e ela deixa de ser a fonte viva desta feature.
- **Acesso das contas do roteador muda (D14).** O cron `subscription-overdue-transition` marca `past_due` a conta do roteador vencida há 1 a 5 dias. Antes, essas contas ficavam `active` e iam direto para `restricted`. Agora têm carência e depois somente leitura. É o comportamento pedido, mas muda o acesso de quem hoje cai direto em `restricted`. Confirmar antes do deploy.
- **Corte do Asaas desligado por padrão (D10, D11).** Sem `PAYMENT_PROVIDER_RENEWAL_ENABLED=true`, a conta legada que renova pelo roteador continua com a assinatura recorrente no Asaas, com risco de cobrança em duplicidade. A documentação do Asaas diz que remover a assinatura apaga as cobranças pendentes, mas isso não foi confirmado no sandbox.
- **Alertas de janela fixa ainda existem.** O PR #1381 foi mergeado, e os lembretes por e-mail seguem nos degraus 1–5, 6–15 e 16+ de `lib/billing/delinquency-tier.ts`, enquanto o controle de acesso usa o cálculo dinâmico. Fase F.
- **API do add-on acessível pelo id da cobrança (D16).** O login é exigido na página, não na API.
- **E2E instável fora desta feature.** `templates-flow.spec.ts` (landing pages, `main#top` duplicado) falhou na pipeline do PR #1431 e a `develop` tem falhas recentes de E2E.

## Fontes

- Plano de origem: colado pelo usuário em 2026-11-17, com as fases A a G e o bloco de validação. Recriado e atualizado em [07-plano-das-fases.md](07-plano-das-fases.md).
- Código: `origin/develop`, que contém os PRs #1381, #1408, #1413, #1414, #1431 e #1432.
- O Obsidian deixa de ser a fonte viva a partir desta data. Esta pasta substitui o uso dele para esta feature.
