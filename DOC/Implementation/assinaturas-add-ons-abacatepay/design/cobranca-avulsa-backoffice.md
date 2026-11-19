# Briefing: cobrança avulsa do backoffice (PIX e cartão)

Status: **aprovado com alterações** (respostas do usuário em 2026-11-19). Implementação liberada, respeitando as decisões abaixo.

Superfície: backoffice. Modo do visitante: **Operate** (o operador completa uma tarefa de cobrança).

Tela afetada: `app/backoffice/(app)/payments/features/container/BackofficePaymentsContainer.tsx`, dialog "Nova Cobrança" e a tabela de cobranças acima dele.

## 1. Job e público

- **Quem:** operador ou manager do backoffice Corretor Studio, com permissão de gerenciar cobranças.
- **Situação:** precisa cobrar um cliente (master de conta) de forma avulsa, fora do add-on e da assinatura. Pode estar ao telefone com o cliente.
- **Necessidade:** criar a cobrança em poucos cliques, com a forma de pagamento certa, e entregar o PIX ou ver o resultado do cartão na hora.

## 2. Resultado e prova

- **Ação principal:** criar cobrança (PIX ou cartão) para um cliente com valor e vencimento.
- **Sucesso:** PIX mostra o QR e o código copia e cola na mesma tela. Cartão mostra o resultado (aprovado, pendente ou recusado) sem recarregar a página.
- **Verdade do produto:** a cobrança nasce no AbacatePay. Os tipos disponíveis são os habilitados na configuração do provider (PIX ativo e `card_enabled`). Boleto sai do formulário.

## 3. Direção escolhida

- **Estrutura:** mantém a tabela de cobranças e o dialog "Nova Cobrança". Nenhuma tela nova.
- **Ordem do dialog:** Cliente, Tipo de cobrança, Valor, Vencimento, Descrição. Campos de documento e de cartão aparecem só quando necessários.
- **Foco:** o botão de criar cobrança é o único primário do dialog (laranja, `--btn-primary-bg`). Cancelar é `outline`.
- **Densidade:** Operate. Sem decoração, sem cards de destaque. Hierarquia por tipografia do `DESIGN.md` (título 16px Poppins, rótulo 13px Inter).

## 4. Escopo e limites

- **Dentro:** formulário PIX e cartão, validação, estados de envio, resultado PIX e cartão, pedido de CPF ou CNPJ quando o cliente não tiver documento.
- **Fora:** boleto; parcelamento (ver pergunta aberta A); edição ou cancelamento de cobrança já criada; Asaas.
- **Intocado:** tabela, badges de status, coluna de invoice, permissões (`canManage`).
- **Anti-metas:** nenhum dado de cartão (número, CVV) passa pelo nosso servidor. A tokenização acontece no navegador com a chave pública do provider, como no checkout de add-on.

## 5. Estados e faixas

- **Lista de clientes:** mostra todos os clientes do backoffice. O critério deixa de ser `asaasCustomerId`.
- **Cliente sem CPF ou CNPJ:** o dialog pede o documento antes de criar a cobrança. Ao confirmar, o documento é salvo no cadastro do cliente e a cobrança segue. Isso exige um endpoint de atualização do documento do cliente (ver backend).
- **Valor:** de R$ 0,01 até o limite que o provider aceitar. Vencimento opcional.
- **Carregando:** botão em estado de envio, campos bloqueados, sem duplo clique (o `submitLock` existente continua).
- **Erro:** mensagem pt-BR no próprio dialog, sem `alert`. Cartão recusado mostra o motivo que o provider devolver, sem expor dados.
- **Cartão indisponível:** a opção não aparece (regra atual com `cardOffered`).
- **Sucesso PIX:** dialog com QR, código copia e cola e botão "Copiar código" (já existe).
- **Sucesso cartão:** resultado no próprio dialog, com a cobrança já na tabela.
- **Vazio da tabela:** mantém "Nenhuma cobrança encontrada".

## 6. Interação e layout

- **Tipo de cobrança:** Select com PIX e Cartão de crédito (este último só se habilitado). Boleto não aparece para novas cobranças. Cobranças antigas de boleto continuam com o rótulo na tabela.
- **Documento do cliente:** campo CPF ou CNPJ, com máscara, aparece só quando o cliente não tiver documento.
- **Campos de cartão:** número, validade, CVV, nome impresso e CPF/CNPJ do titular, em bloco abaixo do Tipo. Um campo por linha em mobile.
- **Responsivo:** dialog em largura total em 375 px, sem rolagem horizontal. Alvos de toque de 44 px no mobile (padrão `max-lg:h-11` já usado na tela).
- **Foco:** anel visível em todos os controles. Ordem de tabulação segue a ordem visual.
- **Movimento:** só opacidade, respeitando `prefers-reduced-motion`.

## 7. Restrições

- Cores e espaçamentos por token semântico. Sem hex no JSX.
- Texto de interface em português do Brasil. Identificadores em inglês.
- Componentes shadcn já usados na tela (Dialog, Select, Input, Label, Button, Alert).

## 8. Decisões tomadas

1. **Cliente sem CPF/CNPJ:** pedir o documento no dialog e salvar no cliente.
2. **Tokenização:** o cartão é tokenizado no navegador com a chave pública do provider (mesmo mecanismo do checkout de add-on).
3. **Campos de cartão:** no mesmo dialog, abaixo do Tipo, sem segunda etapa.
4. **Boleto em cobranças antigas:** só o rótulo na tabela; as linhas continuam visíveis.

## 9. Pergunta aberta (bloqueia só a parte de parcelamento)

**A. Parcelamento no cartão avulso.** Você disse que o parcelamento só se habilita se o produto tiver mais de 1 parcela. A cobrança avulsa não tem produto nem número de parcelas hoje (no add-on, o limite vem dos meses restantes da assinatura). Sem essa fonte, proponho:
- **Opção A (implementar agora):** avulsa fica só à vista (1x). O seletor de parcelas não aparece. Entra quando houver produto com mais de uma parcela.
- **Opção B:** adicionar um campo "Parcelas" no formulário, visível só quando o valor informado tiver mais de uma parcela configurada. Exige definir a regra de parcelas por valor.

Enquanto você não responder, implemento a Opção A.

## Registro de achados do contexto (Impeccable)

- `PRODUCT.md` ainda tem a seção `## Register`, que o modo por superfície substituiu. Não influenciou este briefing.
- `.impeccable/design.json` está desatualizado em relação ao `DESIGN.md`. Rodar `document` atualiza o sidecar, se você quiser.
