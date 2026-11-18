# SPEC de frontend: assinaturas e add-ons

**Estado:** em implementação. Duas telas de backoffice no PR #1381. Demais telas não iniciadas.
**Backend relacionado:** [spec-backend.md](spec-backend.md)
**Notas de implementação e gates:** [02-frontend.md](02-frontend.md)
**Decisões:** [05-decisoes.md](05-decisoes.md) · **Progresso:** [04-progresso.md](04-progresso.md)

Este documento descreve estrutura, regras, interações e estados de cada tela. Não descreve passos de implementação.

Regra de processo: toda tela passa pelo briefing `impeccable shape` antes do JSX, com aprovação. Depois de implementada, passa pela revisão `impeccable`. Nenhuma tela é reportada como pronta sem as duas etapas e a verificação no navegador.

## Índice de telas

| Tela | Onde | Estado |
| --- | --- | --- |
| T1. Badge de acesso | Backoffice, detalhe do cliente | Implementada no PR |
| T2. Cancelar fatura | Backoffice, aba Faturas | Implementada no PR |
| T3. Pagamento de add-on com cartão | Checkout de add-on | Decidida (D1). Não implementada |
| T4. Indicador de modo leitura | Shell do Corretor Studio | Não iniciada |
| T5. Marcar como paga externamente | Backoffice, aba Faturas | Não iniciada |
| T6. Página de assinatura | Corretor Studio, assinatura | Não verificada |

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

**Estado de implementação:** botão, condição de exibição e dialog presentes no PR. Não há teste automatizado do botão.

**Pendências:** teste automatizado, teste no navegador, `impeccable`.

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

**Estado de implementação:** decidido, não implementado. Hoje o formulário de add-on envia número e CVV ao servidor.

## T4. Indicador de modo leitura (shell)

**Onde:** shell do Corretor Studio, em todas as telas autenticadas.

**Objetivo:** avisar que a conta está em modo leitura e explicar que escrita está bloqueada.

**Regras:**
- Aparece só quando o `mode` retornado por `FeatureAccessService` for `read_only`.
- Botões de escrita ficam desabilitados, com explicação ao passar o cursor ou focar.

**Estado de implementação:** não iniciada. O campo `mode` já existe no backend (PR).

**Pendências:** briefing, implementação, teste de navegação e revisão `impeccable`. Fica para a Fase G, depois de 19/11.

## T5. Marcar como paga externamente (backoffice)

**Onde:** aba Faturas. Reaproveita o item de menu "Confirmar recebimento em dinheiro" como ponto de entrada.

**Objetivo:** registrar baixa manual de fatura, com comprovante.

**Interação:**
1. O dialog pede referência e comprovante. O comprovante é opcional, mas a referência é obrigatória.
2. Após confirmar, a fatura muda para paga com a marca de baixa externa.

**Regras:** só para fatura pendente. Não reaproveita o waive.

**Estado de implementação:** não iniciada.

## T6. Página de assinatura

**Onde:** `app/[supabaseId]/subscription/features/container/SubscriptionContainer.tsx`.

**Regras:**
- Visível só para `isMaster` ou `canManageAccountTeams`.
- Para os demais, a página não aparece no menu e uma tentativa direta mostra mensagem de acesso restrito.
- A API também nega a esses usuários (R6, ver [spec-backend.md](spec-backend.md)).

**Estado de implementação:** não verificada.

## Requisitos comuns

- Textos em PT-BR, sem Title Case nos títulos.
- Valores em reais e datas no fuso do usuário.
- Layout funciona a partir de 375 px, sem rolagem horizontal.
- Tokens de design do projeto. `bun run design:check` precisa passar em telas novas.
