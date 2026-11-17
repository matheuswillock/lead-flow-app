---
mode: 'agent'
description: "Cria e atualiza a documentação de implementação de uma feature em DOC/Implementation/<feature>/. Gera visão da feature, SPECs de frontend e backend, notas com gates, progresso com auditoria e registro de decisões. Usar quando o usuário pedir documentação, SPEC, plano de implementação ou nota de progresso de uma feature."
---

<!-- GENERATED FILE - DO NOT EDIT DIRECTLY -->
<!-- Source: .claude/skills/feature-implementation-docs/SKILL.md -->
<!-- Regenerate with: bun run skills:sync -->


# Documentação de implementação de feature

## Estrutura

Pasta: `DOC/Implementation/<feature>/`. O nome é curto, em kebab-case, e igual à branch quando possível.

| Arquivo | Conteúdo |
| --- | --- |
| `README.md` | Índice dos documentos e tabela de estado das SPECs por capacidade |
| `01-feature.md` | Por que a feature existe, o que implementa, escopo, fora de escopo, riscos e fontes |
| `spec-frontend.md` | Telas, regras, interações, estados e estado de implementação de cada tela |
| `spec-backend.md` | Capacidades, regras de negócio, contratos, dados, testes exigidos e pendências |
| `02-frontend.md` | Notas de implementação de frontend, com gates |
| `03-backend.md` | Notas de implementação de backend, com gates |
| `04-progresso.md` | Estado da entrega, árvore de execução, auditoria, log e gates raiz |
| `05-decisoes.md` | Decisões D1 a Dn, com motivo, consequências e status |
| `design/<tela>.md` | Briefing aprovado de cada tela, criado pelo `screen-design-gate` |

## Regras

1. Toda afirmação de estado precisa de evidência: comando com resultado, arquivo com linha ou commit. Sem evidência, escreva "não verificado".
2. Use sempre este vocabulário de estado: Implementado, Parcial, Localmente, Pendente, Decidido, Não iniciado, Não verificado.
3. Gate: `- [ ] ID: descrição`, com linhas `CHECK` (comando), `EXPECT` (resultado esperado) e `EVIDENCE` (resultado observado). Marque `[x]` só com evidência registrada.
4. `04-progresso.md` é append-only. Nunca reescreva entrada antiga. Corrija com entrada nova e datada.
5. Registre branch, commit e estado do push. Push bloqueado é estado da entrega, não detalhe.
6. Audite antes de afirmar. Para código do próprio branch use `git grep` no ref certo, como `HEAD`, `origin/<branch>` e `origin/develop`. Comparar com a develop mostra o que ainda não entrou.
7. Cada SPEC linka para a outra, para as notas, para `05-decisoes.md` e para `04-progresso.md`.
8. Não grave segredo, chave de API, número de cartão, CVV ou token. Chave pública pode aparecer.
9. Não crie resumo de entrega avulso. Esses arquivos são o rastreio solicitado.
10. Conteúdo em português do Brasil, títulos em sentence case, sem Title Case.

## Esqueleto dos arquivos

`README.md`: título, links, tabela `Tela ou capacidade | Backend | Frontend | Integração funcional`.

`01-feature.md`: `## Por que a feature existe`, `## O que a feature implementa` (tabela de fases com estado), `## Decisões`, `## Fora de escopo`, `## Riscos`, `## Fontes`.

`spec-frontend.md`: índice de telas e, para cada tela, `Onde`, `Objetivo`, `Regras`, `Interações`, `Estados`, `Estado de implementação`, `Pendências`.

`spec-backend.md`: `## Cobertura funcional` (tabela), `## Regras de negócio` (R1, R2...), `## Contratos` (tabela de endpoints com estado atual e alvo), `## Dados`, `## Testes exigidos` (tabela com estado), `## Pendências`.

`02-frontend.md` e `03-backend.md`: um nó por capacidade, com `Estado`, `Arquivos` e gates `- [ ] X.G1`.

`04-progresso.md`: `## Estado da entrega`, `## Árvore de execução`, `## Auditoria` (tabela Verificação | Comando | Resultado), `## Registro cronológico (append-only)`, `## Pendências que bloqueiam`, `## Gates raiz` (R1 a R4).

`05-decisoes.md`: uma seção por decisão, com `Decisão`, `Por quê`, `Consequências` e `Status` (data e quem decidiu).

## Fluxo

1. Leia o plano ou o pedido e liste o que foi decidido, o que está em aberto e o que está fora de escopo.
2. Audite o código e os refs antes de escrever o estado de cada item.
3. Escreva `01-feature.md`, depois as SPECs, as notas com gates e as decisões.
4. Escreva `README.md` por último, com a tabela de estado conferida contra as SPECs.
5. Se o projeto tiver `lint:pt-br:strict`, rode-o. Não declare conclusão com lint falhando.

## Tela da feature

Cada tela tem um briefing em `design/<tela>.md`, criado antes do JSX pelo `screen-design-gate`. Se a SPEC de frontend lista uma tela sem briefing aprovado, marque a tela como "Não iniciado" até o briefing existir.
