# Briefing: aba Faturas do detalhe do cliente (backoffice) no celular

**Status:** aprovado pelo responsável em 2026-11-18. A implementação foi feita antes da aprovação, por instrução direta, e foi revisada depois dela. As quatro perguntas abaixo ficaram sem alteração de escopo: o corte em `md` (768 px) e o badge de status à esquerda do valor seguem como descritos.

## Superfície

Backoffice (detalhe do cliente, aba "Faturas"). Densidade administrativa, uso em desktop como fluxo principal; celular é suporte de consulta e ação rápida.

## Estado atual

Tabela de 7 colunas (ID, Nome, Data, Vencimento, Valor, Status, Ações) com `table-fixed` e larguras percentuais, dentro de `overflow-hidden`. Em 375 px a coluna Ações sai da área visível e o botão "..." não é alcançável.

## Usuário

Operador do backoffice (time interno) consultando faturas de um cliente master. Pode abrir pelo celular para checar uma cobrança, abrir o checkout ou cancelar uma fatura elegível.

## Conteúdo por fatura

- Nome da fatura (ex.: cobrança de add-on, mensalidade)
- ID de exibição (monoespaçado, truncável)
- Valor (moeda BRL, numérico tabular)
- Status (badge com o mesmo rótulo e cor da tabela)
- Data de criação e data de vencimento
- Botão de ações (menu "Ações da fatura": Visualizar, Checkout, Cancelar)

## Estados

- Vazio: "Nenhuma fatura encontrada." (sem alteração)
- Carregando: skeletons de altura fixa (sem alteração de conteúdo)
- Erro: bloco de erro existente (sem alteração)
- Paginação: mantida abaixo da lista nos dois layouts
- Cancelar: diálogo `AlertDialog` existente, sem alteração de texto ou lógica

## Direção visual

- Celular (abaixo de `md`, 768 px): lista vertical de cartões. Cada cartão usa `Card`/superfície de borda (`rounded-lg border bg-card p-4`), sem sombra, conforme DESIGN.md §6 (depth por borda em áreas de dados densos).
- Desktop (`md` para cima): tabela atual, sem mudança visual.
- Tokens apenas: `bg-card`, `border`, `text-muted-foreground`, `text-destructive` e os já usados no badge. Nenhum hex novo em JSX.
- Alvo de toque do botão de ações no celular: 44 x 44 px (`size-11`), exigência de DESIGN.md §8 e do helper `runResponsiveChecks`. Na tabela o botão permanece `size-8`.

## Escopo

Alterar somente a apresentação da aba Faturas em `BackofficeClientDetailsContainer.tsx`, mais um componente novo para o menu de ações. Não alterar:

- a regra `canCancelInvoice` (`features/utils/invoiceActions.ts`)
- textos dos botões ou rótulos de status
- o comportamento de cancelamento, paginação ou filtros
- as outras abas

## O que confirmar antes de aprovar

1. O corte em `md` (768 px) mantém a tabela legível dentro do layout com sidebar? Medição de 768 px pendente.
2. Cartões ou tabela também em tablets (`md`-`lg`)? Este briefing assume `md` como corte.
3. O badge de status nos cartões pode ficar à esquerda do valor, como descrito? Ou prefere outra ordem?
4. Confirmar que "Ações da fatura" continua sendo o rótulo acessível do botão nos dois layouts.
