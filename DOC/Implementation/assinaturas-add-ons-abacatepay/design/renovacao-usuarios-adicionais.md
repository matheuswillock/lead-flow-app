# Briefing: renovação com usuários e times adicionais

**Status:** rascunho aguardando aprovação. Nenhum JSX foi escrito. Pela regra `screen-design-gate`, o JSX só começa depois da aprovação deste documento.
**Superfície:** checkout (renovação do master pela carência).
**Tela:** `app/[supabaseId]/billing-grace-payment/` (`BillingGraceRenewalChoice.tsx` e o container).
**Decisões relacionadas:** [D7](../05-decisoes.md) (aceite no checkout), [D10](../05-decisoes.md) (corte do Asaas na confirmação).

## 1. Propósito

Quem renova depois do vencimento precisa entender, antes de pagar, o que cada prazo custa **para a conta dele**: o plano, os usuários adicionais e os times adicionais. Quem estava no anual tinha usuários ilimitados; ao escolher outro prazo, esses usuários passam a ser cobrados, e a tela precisa dizer isso com os valores.

Sucesso: o master escolhe o prazo sabendo exatamente o que está pagando e por quê, e nenhuma cobrança de usuário ou time o surpreende depois.

## 2. Usuário e contexto

- **Quem:** master da conta, que recebeu o e-mail da carência (ou entrou pelo botão do bloqueio).
- **Onde:** celular ou computador, no meio de outra tarefa. Quer resolver rápido, com atenção ao valor.
- **Estado de espírito:** receio de perder o acesso e de pagar mais do que esperava.

## 3. O que já existe (não muda)

- O prazo do ciclo anterior já vem **pré-selecionado** (`defaultCycleOf`). Quem estava no anual abre o checkout com o anual marcado e troca se quiser. Conta legada guardava `YEARLY`/`SEMIANNUALLY` e caía no primeiro prazo da lista; isso foi corrigido no servidor (a cotação devolve o prazo no vocabulário do checkout), sem alterar a tela.
- A lista "O que está sendo renovado" já mostra o plano, cada usuário adicional (nome, e-mail e valor), cada time adicional e deixa desmarcar quem não continua. No anual mostra "Usuários ilimitados incluídos".
- O dado `losesUnlimitedUsers` já chega calculado em cada prazo. Hoje **nenhuma tela o usa**. É a lacuna deste briefing.

## 4. Conteúdo e dados da mudança

Quando o prazo escolhido tem `losesUnlimitedUsers = true` (a conta tinha usuários ilimitados e este prazo não os inclui), a seção "O que está sendo renovado" ganha um aviso no topo, acima da lista de usuários:

- **Com usuários adicionais:** "Você usava usuários ilimitados no plano anual. Neste prazo, os N usuários adicionais passam a ser cobrados: R$ X por usuário por mês, R$ Y no prazo." O total acompanha as caixas marcadas/desmarcadas (`applyKeptUsers`).
- **Sem usuários adicionais:** "Você deixa de ter usuários ilimitados ao sair do anual. Hoje você não tem usuários adicionais, então não há cobrança extra." (sem tom de alerta, porque não há valor a pagar).
- **Times adicionais:** continuam na lista já existente; o aviso só cita o que muda por causa do prazo (os times têm preço único e são cobrados em qualquer prazo, então não entram no aviso de perda do ilimitado).
- **Saída:** um controle "Manter usuários ilimitados (plano anual)" que seleciona o prazo anual, para quem quer evitar a cobrança.

Na lista de prazos (`BillingGraceCycleChoice`), cada opção sem ilimitado de uma conta que o perde mostra a linha "inclui R$ Z de usuários adicionais", para comparar os prazos sem abrir cada um. (Proposta; ver pergunta 2.)

## 5. Estados

| Estado | Comportamento |
| --- | --- |
| Prazo anual (ou conta sem ilimitado) | Sem aviso. Mantém "Usuários ilimitados incluídos" no anual |
| Outro prazo, conta tinha ilimitado, com usuários adicionais | Aviso com contagem e valores. Total atualiza ao marcar/desmarcar usuários |
| Outro prazo, conta tinha ilimitado, sem usuários adicionais | Aviso informativo, sem valor |
| Todos os usuários desmarcados | Aviso passa a dizer que nenhum usuário adicional será cobrado e que quem foi desmarcado perde o acesso (já há confirmação "Tem certeza?" antes de pagar) |
| Troca de prazo | O aviso e os valores recalculam na hora, sem recarregar |
| Carregando, erro, sem prazos | Inalterados |

## 6. Direção visual

- **Tokens:** `--semantic-warning-surface`, `--semantic-warning-border` e `--semantic-warning` (já existem em `DESIGN.md`); texto em `foreground`. Sem hexadecimal solto.
- **Padrão:** mesmo formato do aviso de sucesso que já existe no bloco ("Usuários ilimitados incluídos"): caixa arredondada, ícone à esquerda, texto curto. O aviso informativo (sem valor) usa `--semantic-info-*`.
- **Ícone:** `Infinity` riscado ou `TriangleAlert` da Lucide, tamanho igual ao do aviso atual.
- **Responsivo:** em 375 px o aviso ocupa a largura toda e o controle "Manter ilimitados" vai abaixo do texto; em 1440 px fica na mesma coluna do bloco.
- **Acessibilidade:** aviso com `role="status"`, contraste dos tokens semânticos, controle alcançável por teclado com foco visível.
- **Cor:** Restrained. O aviso é o único elemento colorido novo da seção.

## 7. Escopo

- **Fidelidade:** pronta para produção.
- **Arquivos:** `BillingGraceRenewalChoice.tsx` (aviso e linha por prazo) e o container (ação de selecionar o anual). Sem tela nova, sem componente novo.
- **Texto:** PT-BR, valores formatados com `formatBRL`, sem travessão.

## 8. Perguntas para aprovação

1. O controle "Manter usuários ilimitados (plano anual)" entra, ou o aviso só informa e o master escolhe o anual na lista?
2. A linha "inclui R$ Z de usuários adicionais" em cada prazo da lista entra agora ou fica para depois?
3. Quando a conta não tem usuários adicionais, o aviso informativo aparece ou a tela só some com o "ilimitados" sem comentar?
