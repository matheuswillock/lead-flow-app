---
target: app/[supabaseId]/whatsapp/features
total_score: 22
p0_count: 1
p1_count: 4
timestamp: 2026-07-23T17-39-31Z
slug: app-supabaseid-whatsapp-features
---

Method: dual-agent (A: `/root/impeccable_critique_a` · B: `/root/impeccable_critique_b`)

# WhatsApp Inbox — Impeccable Critique

## Design Health Score

| #         | Heurística                  |      Nota | Problema-chave                                                     |
| --------- | --------------------------- | --------: | ------------------------------------------------------------------ |
| 1         | Visibilidade do status      |       2/4 | Primeiro envio e saúde Realtime não são comprovados ao usuário.    |
| 2         | Sistema × mundo real        |       3/4 | Chat é familiar; filtros/handoff/sync exigem contexto.             |
| 3         | Controle e liberdade        |       2/4 | Há cancelar/voltar/arquivar; faltam undo e recuperação uniforme.   |
| 4         | Consistência e padrões      |       3/4 | Base sólida; “Nova conversa/Novo contato” diverge.                 |
| 5         | Prevenção de erros          |       2/4 | Validações existem; envio inicial e anexos não previnem incerteza. |
| 6         | Reconhecimento, não memória |       2/4 | Usuário precisa inferir filtros, sync e destino do envio.          |
| 7         | Flexibilidade e eficiência  |       2/4 | Enter/menções ajudam; faltam atalhos, busca unificada e lote.      |
| 8         | Estética e minimalismo      |       2/4 | Conteúdo limpo; cabeçalhos acumulam controles.                     |
| 9         | Diagnóstico e recuperação   |       2/4 | Texto pode reenviar; mídia/mic/sync não recuperam bem.             |
| 10        | Ajuda e documentação        |       2/4 | Ajuda existe, mas não é contextual nos vales críticos.             |
| **Total** |                             | **22/40** | **Aceitável — melhorias significativas.**                          |

## Anti-patterns verdict

**Aprovado com ressalvas.** A Inbox não parece uma galeria de UI gerada por IA: usa componentes consistentes, tokens semânticos, hierarquia familiar, skeletons e estados de envio. O problema é de foco: em alguns estados ela parece um CRM com chat embutido, não um mensageiro operacional maduro.

O detector determinístico retornou `[]` para `app/[supabaseId]/whatsapp/features`. Zero findings automáticos não invalida problemas manuais de fluxo, carga cognitiva, recuperação ou corrida de estado.

Browser overlay não foi produzido: a rota exige autenticação/contexto de time e não havia browser autenticado com injeção mutável. Foram usados source, capturas dos usuários e screenshots/source do clone como fallback.

## Overall impression

A aparência básica já tem boa paridade com um mensageiro, mas a experiência não entrega a mesma confiança operacional. A maior oportunidade é fazer contato → conversa → primeira mensagem parecer uma única jornada contínua e comprovável.

## What's working

- Estrutura master-detail com alternância lista/painel no mobile.
- Estados PENDING/SENT/DELIVERED/READ/FAILED e bolha otimista.
- Tokens, dark mode, skeletons, teclado para menções e envio.

## Priority issues

### [P0] Primeiro envio pode parecer perdido

**Why it matters:** quebra a confiança central e reproduz o relato de suporte.

**Fix:** inserir conversa e bolha `PENDING` imediatamente, manter `clientMessageId` estável, reconciliar HTTP/Reatime/webhook e oferecer retry seguro.

**Suggested command:** `$impeccable harden`.

### [P1] Busca não significa “buscar ou iniciar conversa”

**Why it matters:** contatos sincronizados e números formatados não entram no mesmo modelo mental da busca.

**Fix:** uma busca unificada com Conversas, Contatos e Iniciar com este número, além de zero state que explique filtros e sync.

**Suggested command:** `$impeccable shape`.

### [P1] Cabeçalho mistura chat e administração

**Why it matters:** lead, vínculo, tags, responsável, menu, conexão e sync competem com identidade e composer; há risco de overflow mobile.

**Fix:** preservar identidade/status, uma ação principal e overflow; levar CRM para painel/sheet contextual.

**Suggested command:** `$impeccable distill`.

### [P1] Recuperação do microfone não conduz ao sucesso

**Why it matters:** o alerta informa o problema, mas não resolve a tarefa para usuários mobile.

**Fix:** “Como liberar”, instrução por browser/OS, “Testar novamente” e confirmação de mudança.

**Suggested command:** `$impeccable clarify`.

### [P1] Targets e semântica incompletos

**Why it matters:** filtros, attach, emoji, send e áudio ficam abaixo de 44 px; lightbox e seleção não comunicam estado completamente.

**Fix:** ampliar hit areas, safe area, labels/ARIA e dialog com foco/Escape.

**Suggested command:** `$impeccable adapt`.

## Cognitive load

| Critério               | Resultado |
| ---------------------- | --------- |
| Foco único             | Falha     |
| Chunking ≤4            | Falha     |
| Agrupamento            | Passa     |
| Hierarquia visual      | Falha     |
| Uma coisa por vez      | Passa     |
| Escolhas mínimas       | Falha     |
| Memória de trabalho    | Falha     |
| Divulgação progressiva | Passa     |

**5/8 falhas — carga alta.**

## Emotional journey

1. Entrada: skeletons e banner geram confiança moderada.
2. Orientação: dois CTAs e filtros criam sobrecarga.
3. Composição: composer é familiar.
4. Momento da verdade: primeiro envio pode desaparecer localmente.
5. Recuperação: texto tem retry; mídia e microfone terminam em suporte.

## Persona red flags

### Alex — power user

- sem atalhos para busca, próxima conversa, arquivar e composer;
- paginação manual e nenhuma ação em lote;
- listas de responsável sem busca.

### Sam — teclado/screen reader

- busca sem label explícito;
- seleção comunicada principalmente por cor;
- lightbox sem dialog/focus trap;
- alvos menores que 44 px.

### Casey — mobile

- ações importantes acumuladas no topo;
- nome longo pode comprimir controles;
- alerta de microfone sem CTA;
- safe area e teclado virtual sem verificação autenticada.

### Bruno — operador

- não consegue provar instantaneamente que o primeiro envio persistiu;
- resultado zero não diferencia ausência, filtro, permissão ou sync;
- tarefa localizar→responder compete com administração.

## Minor observations

- “Ajuda do Inbox” em linha exclusiva consome altura.
- Estado vazio deveria oferecer limpar filtros/iniciar conversa.
- Arquivar deve dominar exclusão permanente.
- Player de áudio não anuncia falha de carregamento.
- Presença/typing só deve existir com sinal confiável.
- Origem/licença dos wallpapers atuais deve ser verificada.

## Questions to consider

- Quais três elementos realmente precisam ficar visíveis antes de o operador enviar?
- Por que “Novo contato” e “Nova conversa” são conceitos diferentes se ambos terminam em um chat?
- Que evidência inequívoca prova persistência local, envio ao provider e reconciliação?
- Quando a busca retorna zero, a interface explica ausência, filtro, permissão ou sincronização?
