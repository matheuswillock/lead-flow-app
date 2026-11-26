# Assinaturas e add-ons: cobrança AbacatePay, acesso e gestão de faturas

- Status geral: em implementação. Detalhe em [04-progresso.md](04-progresso.md).
- Branch: `feature/bloqueio-assinatura-somente-leitura`
- PR: [#1381](https://github.com/matheuswillock/lead-flow-app/pull/1381) (base `develop`)
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
| A | Acesso em carência: liberação genérica por contrato, badge tri-estado do backoffice, botão "Cancelar" fatura | sim | implementada no PR, não na develop |
| B | Add-ons (time, usuário, créditos) cobrados pelo AbacatePay | não | B-1 e B-2 implementadas localmente, não enviadas |
| C | Renovação reativa pelo roteador: e-mail dos dois avisos da carência, `past_due` por data para contas do roteador, corte do Asaas na confirmação do pagamento, aviso de perda do ilimitado na tela de renovação (o cron de renovação antecipada foi removido, D8) | não | backend e tela implementados na branch da Fase C, sem sandbox. Ver [06-fase-c-renovacao.md](06-fase-c-renovacao.md) |
| D | "Marcar como paga externamente" com comprovante (só backoffice) | não | não iniciada |
| E | Página de assinatura restrita a master ou delegado | não | não verificada |
| F | Alertas de inadimplência: verificar destinatário e fechar BILLING-GRACE-T002 | não | parcial: os dois avisos da carência foram feitos na Fase C (D12). Falta confirmar o destinatário e os degraus de janela fixa (ver riscos) |
| G | Indicador de modo leitura no shell; padronização visual das ações de fatura | não | não iniciada |

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

## Fora de escopo

- Migração de dados de produção.
- Aplicação de migrations em qualquer banco. A aplicação segue o fluxo da pipeline após o merge na develop.
- Deploy e cobrança real na AbacatePay (sandbox fica para validação manual).

## Riscos

- **Cartão de add-on indisponível.** Hoje add-ons por cartão funcionam no Asaas. Depois da B-1 eles ficam indisponíveis até a implementação de D1 (F7). Esse é o principal risco de regressão antes do merge.
- **Dado sensível no servidor hoje.** O add-on por cartão atual envia número e CVV ao servidor. D1 remove isso.
- **Contas legadas sem `subscriptionNextDueDate`** continuam sem carência. Volume real em produção não foi medido.
- **Decisão 13 da spec antiga diverge** da decisão atual (todo pagamento novo vai para o AbacatePay). A spec no Obsidian ainda não foi atualizada, e ela deixa de ser a fonte viva desta feature.
- **Acesso das contas do roteador muda (D14).** O cron `subscription-overdue-transition` marca `past_due` a conta do roteador vencida há 1 a 5 dias. Antes, essas contas ficavam `active` e iam direto para `restricted`. Agora têm carência e depois somente leitura. É o comportamento pedido, mas muda o acesso de quem hoje cai direto em `restricted`. Confirmar antes do deploy.
- **Corte do Asaas desligado por padrão (D10, D11).** Sem `PAYMENT_PROVIDER_RENEWAL_ENABLED=true`, a conta legada que renova pelo roteador continua com a assinatura recorrente no Asaas, com risco de cobrança em duplicidade. A documentação do Asaas diz que remover a assinatura apaga as cobranças pendentes, mas isso não foi confirmado no sandbox.
- **PR #1381 não deve ser mergeado com os alertas de janela fixa.** Os lembretes por e-mail ainda usam os degraus 1–5, 6–15 e 16+ de `lib/billing/delinquency-tier.ts`. O controle de acesso já usa o cálculo dinâmico.

## Fontes

- Plano de origem: colado pelo usuário em 2026-11-17, com as fases A a G e o bloco de validação.
- Código: branch local `feature/bloqueio-assinatura-somente-leitura` e head remoto `ccb52a4ae` do PR #1381.
- O Obsidian deixa de ser a fonte viva a partir desta data. Esta pasta substitui o uso dele para esta feature.
