# Briefing: checkout de add-on (cartão tokenizado)

**Status:** rascunho aguardando aprovação. Nenhum JSX foi escrito. Pela regra `screen-design-gate`, o JSX só começa depois da aprovação deste documento.
**Tela:** `app/addon-checkout/[pendingActionId]/`
**Decisões relacionadas:** [D1](../05-decisoes.md), [D2](../05-decisoes.md), [D5](../05-decisoes.md)
**Backend:** pagamento com `cardToken` já implementado (commit `942e23c8e`).

## 1. Propósito

Permitir que o master ou o operador de uma corretora compre um add-on (time, usuário ou créditos) e pague com PIX ou cartão, sem que o número do cartão passe pelo servidor.

Sucesso: o cliente conclui a compra sem sair da tela, entende o estado da cobrança em cada momento, e não paga duas vezes.

## 2. Usuário e contexto

- **Quem:** master ou operador da corretora, que recebeu o link de compra. Pode ser um não técnico, com pouca familiaridade com cobrança online.
- **Onde:** celular ou computador, em escritório, em horário comercial. Costuma abrir o link no meio de outra tarefa.
- **Estado de espírito:** focado em concluir rápido, com atenção aos valores. Algumas pessoas chegam com desconfiança sobre pagamento com cartão.

## 3. Conteúdo e dados

- Produto comprado: tipo (time, usuário ou créditos), descrição, valor mensal, período restante, total cobrado.
- Forma de pagamento: PIX ou cartão, com a forma pré-selecionada conforme o `presetBillingType` da ação.
- Dados do cliente: nome, e-mail, CPF ou CNPJ, telefone e endereço, já preenchidos a partir do cadastro quando existirem.
- Cartão: campo montado pelo `abacatepay.js` (titular, número, validade e CVV ficam dentro do campo do provider). A aplicação recebe só o `ctok_`.
- Parcelas: até `maxInstallments` no cartão.
- Faixas realistas: valor de R$ 5 a alguns milhares de reais. Parcelas de 1 a 12.

## 4. Estados

| Estado | Comportamento |
| --- | --- |
| Carregando o checkout | Esqueleto, sem campos interativos |
| Carregando o campo do cartão | Botão "Pagar" desabilitado, com mensagem curta |
| Cartão incompleto ou inválido | Botão desabilitado. Erro só aparece depois do clique |
| Cartão com 3DS recusado | Mensagem clara, dados do cliente preservados, botão reabilitado |
| Erro de rede ou da API | Mensagem com opção de tentar de novo, sem perder dados |
| Aguardando confirmação | Tela de processamento com consulta de status (escolha confirmada) |
| Confirmado | Confirmação com o produto liberado e próximo passo |
| Recusado | Mensagem da recusa, com opção de trocar a forma de pagamento se ainda for possível |
| Checkout expirado (24 h) | Mensagem de expiração e orientação para pedir um novo link |
| Tentativa substituída (D2) | Se a forma foi trocada e a cobrança anterior foi paga, a tela mostra que a troca não é possível |
| Ex-assinante com cartão do Asaas (D5) | Aviso de que o cartão precisa ser cadastrado de novo para esta compra |

## 5. Direção visual

- **Estratégia de cor:** Restrained, conforme `DESIGN.md`. Sem cor de destaque além da ação principal.
- **Cena:** um master ou operador de corretora, sentado em escritório com luz natural, finalizando uma compra de add-on no celular antes de voltar ao trabalho. A cena pede tela clara e legível, sem excesso de decoração.
- **Âncoras:** a tela `/checkout` (self-checkout, com resumo lateral e forma de pagamento); o bloco de cartão tokenizado da adesão (`AbacateCardField`); a identidade visual de `DESIGN.md`.

## 6. Escopo

- **Fidelidade:** pronta para produção (shipped-quality).
- **Amplitude:** fluxo completo, da escolha da forma de pagamento até o estado final.
- **Interatividade:** componente real, com as validações e os estados da seção 4.
- **Intenção de tempo:** polimento até ficar pronto.

## 7. Pontos a confirmar antes da aprovação

1. **Base de componentes.** Hoje a tela de add-on usa `PublicCheckoutFlow` (`components/public-checkout`). O `/checkout` usa os componentes `SelfCheckout*`. Você pediu o layout do `/checkout`, então a proposta é migrar para `SelfCheckout*`. Isso muda componentes visíveis. Precisa confirmar.
2. **Provider e tokenização.** PIX e cartão continuam no AbacatePay, com o mesmo `AbacateCardField` da adesão. Nada muda no provider.
3. **Mensagem para ex-assinantes do Asaas (D5).** Texto e lugar do aviso de recadastro do cartão.
4. **Troca de forma (D2).** A regra de bloqueio já está implementada. Confirmar o texto da mensagem quando a troca for recusada.

## 8. Fora de escopo

- Mudança no design do `/checkout` principal.
- Cobrança por boleto (AbacatePay não suporta).
- Tratamento do risco residual de pagamento em tentativa substituída (D2). Depende de decisão separada.

## 9. Validação depois da implementação

Conforme `screen-design-gate`: sequência `impeccable` (harden, clarify, adapt, typeset, colorize, polish), `design:check`, e verificação renderizada em 375 px e 1440 px, com os estados das seções 4 e a tela aberta no navegador.

## Aprovação

- [ ] Briefing aprovado pelo usuário em ______ (data). Alterações pedidas: ______
