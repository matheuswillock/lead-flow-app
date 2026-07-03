# Crítica de Design — Páginas do App (Impeccable · Register Product)

**Data:** 2026-07-02
**Método:** análise estática de código (somente leitura), sem browser/detector — execução single-context a pedido do solicitante.
**Referências:** `.agents/skills/impeccable/reference/critique.md`, `reference/audit.md`, `reference/product.md`, `DESIGN.md` (Hybrid Warm-Precision, tokens `--semantic-*`/`--surface-*`/`--sim-op-*`), regras de composição shadcn do `agents.md`.
**Escopo:** 13 rotas autenticadas em `app/[supabaseId]/` (register **product** — o usuário é um corretor em tarefa, sob pressão; o critério é velocidade até a próxima ação e familiaridade confiável, não impacto visual).

**Severidades:** P0 = quebra uso/contraste/acessibilidade · P1 = inconsistência clara com DESIGN.md/regras do projeto · P2 = polimento.

## Resumo executivo

| # | Página | Nota | P0 | P1 | P2 |
|---|--------|------|----|----|----|
| 1 | CRM | 7,0 | 0 | 3 | 2 |
| 2 | Dashboard | 4,0 | 1 | 4 | 3 |
| 3 | PME Simulador | 8,0 | 0 | 1 | 2 |
| 4 | Calendar | 6,0 | 0 | 2 | 2 |
| 5 | Docs | 7,0 | 0 | 1 | 3 |
| 6 | Performance | 5,0 | 1 | 3 | 3 |
| 7 | WhatsApp | 8,5 | 0 | 0 | 2 |
| 8 | Carteira | 7,0 | 0 | 2 | 3 |
| 9 | Email · Templates | 8,0 | 0 | 0 | 3 |
| 10 | Email · Configurações | 6,5 | 0 | 2 | 2 |
| 11 | Lead Transfers | 8,0 | 0 | 0 | 2 |
| 12 | Email · Contatos | 6,0 | 0 | 2 | 2 |
| 13 | Email · Campanhas | 7,0 | 0 | 1 | 2 |

**Padrões sistêmicos** (aparecem em 3+ páginas e merecem correção transversal, não pontual):

1. **Cores raw Tailwind em vez de tokens semânticos** — `orange-500` (CRM e Carteira filter bars), `amber-*` (Campanhas), `emerald/red` (Contatos), `green/blue/purple/yellow/red` (Dashboard), `green/red/yellow` (Calendar). O sistema de tokens `--semantic-*` existe, está documentado no DESIGN.md §9 e é usado corretamente em Lead Transfers, Carteira (stats) e PME Simulador — a violação é de disciplina, não de infraestrutura.
2. **`space-y-*` em vez de `gap-*`** — Docs (15 ocorrências), Dashboard, Contatos, CRM, Carteira. Regra explícita do `agents.md`.
3. **Skeletons custom com `animate-pulse`** em vez do componente `Skeleton` — PME Simulador (`loading.tsx`, `SimulationResults`), Performance (`PerfKpis`, `PerfTopHighlights`, `PerfRankings`). Regra explícita, e o componente já é usado corretamente nas demais páginas.
4. **Ternários manuais em template literal em vez de `cn()`** — `CrmFiltersBar.tsx:401`, `CarteiraFiltersBar.tsx:421`, `CampanhasContainer.tsx:68`, `CreditBalanceBar.tsx:70,76`.
5. **Copy sem acentuação** em superfícies visíveis — Performance ("Ultima atualizacao", "Exportar relatorio", "reunioes... periodo"), Docs ("Capitulo atual", "Documentacao"), PME ("esta disponível"). O `lint:pt-br` deveria capturar isso.
6. **Vocabulário de tabs inconsistente entre páginas irmãs** — Templates usa tab sublinhada custom, Campanhas usa pills custom, Carteira usa `Tabs` do shadcn. Três padrões para o mesmo conceito dentro do mesmo produto (Nielsen #4; ban do register product: "inconsistent component vocabulary across screens").

---

## 1. CRM (`app/[supabaseId]/crm/`) — a página mais usada

### Nota: 7,0 / 10

**Impressão geral.** Arquitetura exemplar: `CrmContainer.tsx` é um orquestrador fino que alterna Kanban (`board/`) e Pipeline (`pipeline/`) preservando filtros externos — o corretor troca de visão sem perder contexto. A barra de filtros é o ponto forte da página: presets salvos por time com "último usado" persistido em localStorage (`CrmFiltersBar.tsx:290-314`) é exatamente o acelerador que o persona power-user (Alex) precisa. Os cards do kanban usam tokens semânticos e badges correta­mente (`board/features/container/LeadCard.tsx:179-238`).

### Achados

#### P1 — `loading.tsx` da rota mais usada retorna `null`
`app/[supabaseId]/crm/loading.tsx:1-3` — `return null`. Durante a transição de rota o usuário vê tela em branco; o skeleton só aparece depois que o `CrmContainer` monta e o contexto resolve (`CrmContainer.tsx:47-55`). Compare com `calendar/loading.tsx`, que desenha a estrutura completa da página. Na página de maior tráfego, o flash em branco é a primeira impressão diária do produto.
**Fix:** replicar o skeleton do `CrmContainer` (header + barra de filtros + área 60vh) no `loading.tsx`.

#### P1 — Cor raw `orange-500` no botão de presets
`crm/features/container/CrmFiltersBar.tsx:401,404` — `border-orange-500/70 text-orange-500` e `fill-orange-500` para indicar preset ativo. É o accent da marca, então deveria ser `text-primary`/`border-primary` (o token existe exatamente para isso); além disso a classe condicional usa template literal em vez de `cn()`. O mesmo trecho foi copiado-e-colado para `carteira/features/container/CarteiraFiltersBar.tsx:421-423` — a duplicação espalha a violação.
**Fix:** `cn("h-8 px-2 lg:px-3", isPresetInUse && "border-primary/70 text-primary")` e extrair o botão de presets para componente compartilhado.

#### P1 — Formulário de preset sem `FieldGroup`/`Field` e lista com `space-y-3`
`CrmFiltersBar.tsx:417-431` — os dois inputs do formulário de novo preset estão num `div` com `grid gap-3` sem labels (só placeholder — screen reader não anuncia o campo; WCAG 1.3.1). `CrmFiltersBar.tsx:433` usa `space-y-3` na lista de presets.
**Fix:** migrar para `FieldGroup`+`Field` com `FieldLabel`, trocar `space-y-3` por `flex flex-col gap-3`.

#### P2 — Filtro de status com 14 opções planas
`CrmFiltersBar.tsx:22-37` — 14 status num único multi-select viola o limite de working memory (≤7 no limite, ideal ≤4). O corretor sob pressão escaneia a lista inteira a cada uso.
**Fix:** agrupar visualmente no popover (Funil ativo / Fechamento / Perdas), mantendo o contrato de dados.

#### P2 — `animate-pulse` infinito em cards atrasados do kanban
`board/features/container/LeadCard.tsx:182,187` e `pipeline/features/container/DraggableRow.tsx:50` — cards/linhas com lead-time estourado pulsam para sempre. Motion deve comunicar estado, mas um board com 10 leads atrasados vira uma árvore de natal que compete com o trabalho (register product: "decorative motion that doesn't convey state" — depois do terceiro segundo, o pulso já comunicou).
**Fix:** borda + badge estática de atraso; se quiser motion, pulsar 2-3 ciclos com `animation-iteration-count` e parar.

### Recomendações
1. Implementar `loading.tsx` real (maior ganho de percepção de velocidade por linha de código no app inteiro).
2. Unificar o botão de presets (CRM + Carteira) num componente com `text-primary`.
3. Agrupar os 14 status do filtro em 3 grupos visuais.

---

## 2. Dashboard (`app/[supabaseId]/dashboard/`)

### Nota: 4,0 / 10

**Impressão geral.** É a página mais desalinhada do DESIGN.md em todo o escopo. A seção de cards principais usa **quatro famílias de accent simultâneas** (verde, âmbar, azul, roxo) com gradientes de fundo, borda colorida e `shadow-md` juntos — exatamente o "uncontrolled multi-accent noise" que a Influence Matrix (§2) manda evitar e o padrão hero-metric/card-grid que o Impeccable bane. Nada aqui usa `--semantic-*`: são ~150 ocorrências de cores raw com `dark:` manual. O contraste com o restante do produto (Carteira, Lead Transfers, PME) faz o dashboard parecer de outro app.

### Achados

#### P0 — Grid do funil fixo em 3 colunas quebra no mobile
`features/container/section-cards-with-context.tsx:468` — `<div className="grid grid-cols-3 gap-4">` sem breakpoint. Em 360px cada coluna tem ~104px para conter card com título, tooltip, número em `text-4xl` e lista de 3-4 itens com ícone+label+valor — overflow e texto ilegível garantidos. A Seção 3 repete o problema em menor grau (`:644`, `grid-cols-2` fixo). Todos os demais grids do arquivo usam container queries (`@xl/main:grid-cols-2`), o que confirma que é descuido, não decisão.
**Fix:** `grid-cols-1 gap-4 @xl/main:grid-cols-3` (e `@md/main:grid-cols-2` na Seção 3).

#### P1 — Quatro accents + gradiente + borda colorida + sombra nos cards de métrica
`section-cards-with-context.tsx:353,381,409,437,646,670` — cada card de KPI tem sua própria identidade cromática (`border-green-500/30 bg-gradient-to-br from-green-50... shadow-md dark:from-green-900/20`, e variantes âmbar/azul/roxo/amarelo/vermelho), com emoji no título (💰📊🎯💼). Viola: (a) tokens semânticos obrigatórios; (b) "não misturar mais de duas famílias de accent" (DESIGN.md §5); (c) "borda 1px + sombra larga juntos" e card-grid-de-gradientes são tells de IA; (d) register product — accent é para estado/ação, não decoração. Ironicamente o `FunnelCard` genérico (`:86-134`) é limpo e correto.
**Fix:** cards neutros (`bg-card border-border`) com o **valor** carregando a cor semântica quando fizer sentido (`text-semantic-success` para receita, `text-semantic-danger` para churn), como `CarteiraStatsRow` já faz. Remover emojis dos títulos ou movê-los para os ícones lucide já presentes.

#### P1 — Estados de erro fora do design system, com botão nativo
`dashboard/page.tsx:31-42` — erro global usa `text-red-600`, `text-gray-600` e um `<button>` cru `bg-blue-600 hover:bg-blue-700` (azul num produto orange-led) chamando `window.location.reload()`. `section-cards-with-context.tsx:222` repete `text-red-600` sem ação de recuperação (Nielsen #9: nomeia o problema, não oferece o caminho).
**Fix:** `Alert variant="destructive"` + `Button` do shadcn chamando `refreshMetrics()` do contexto (já existe — recuperação sem reload de página).

#### P1 — Tooltip de informação com borda `border-white/10` e alvo de 24px
`section-cards-with-context.tsx:55` — o botão do `InfoTooltip` usa `border-white/10` (invisível em light mode, hardcoded em vez de token) e `h-6 w-6` = 24px, abaixo do mínimo de 44px do DESIGN.md §8 para o **único** mecanismo de explicação das métricas. Também deveria ser `size-6` pela regra de composição.
**Fix:** `size-6 border-border` no visual + `p-2 -m-2` (ou `size-11` de hit area) para alcançar 44px.

#### P1 — Rota sem `loading.tsx`
`app/[supabaseId]/dashboard/` é a única das 13 rotas sem `loading.tsx`. O `DashboardSkeleton` interno só cobre depois da montagem do client component.
**Fix:** criar `loading.tsx` reutilizando `DashboardSkeleton`.

#### P2 — Componentes mortos com estilo light-only no bundle mental do time
`features/container/components/DashboardMetricsWithContext.tsx` e `DashboardMetrics.tsx` não são importados por ninguém e são inteiramente `bg-white text-gray-*` com spinner custom (`:36`) — quebrariam em dark mode se alguém os reusar (e são o primeiro resultado quando se procura "métricas" na pasta).
**Fix:** deletar os dois arquivos.

#### P2 — Bloco de 55 linhas comentado no meio do container
`section-cards-with-context.tsx:582-637` — seção inteira de "Reuniões realizadas" comentada. Higiene: git guarda histórico.

#### P2 — `space-y-6` no wrapper
`section-cards-with-context.tsx:300` e `dashboard/page.tsx:51` — trocar por `flex flex-col gap-6`.

### Recomendações
1. Reescrever a Seção 1 com cards neutros + valor colorido por token semântico (padrão `CarteiraStatsRow`) — resolve de uma vez o multi-accent, os raws, os `dark:` manuais e o tell de IA.
2. Corrigir os grids fixos (`:468`, `:644`) — é a correção de maior impacto/custo do relatório.
3. Unificar estados de erro em `Alert` + retry via contexto e deletar os componentes mortos.

---

## 3. PME Simulador (`app/[supabaseId]/pme-simulador/`)

### Nota: 8,0 / 10

**Impressão geral.** A melhor relação forma/função do app. Um único card vertical com `Separator` entre etapas (beneficiários → hospital → resumo+CTA) guia o corretor numa sequência óbvia; a linha de totais ("Vidas / Faixas / Hospital") ao lado do botão "Simular planos" mantém o contexto da decisão visível (`PmeSimulatorContainer.tsx:94-124`). O destaque do relatório: `PlanResultCard.tsx:13-21` usa os tokens `--sim-op-*` do DESIGN.md para as cores de operadora — é a prova de que o sistema de tokens funciona quando respeitado. Botão com lock de request e spinner inline corretos (`:112-123`).

### Achados

#### P1 — Loading com `animate-pulse` custom em vez de `Skeleton`
`pme-simulador/loading.tsx:4-7` e `features/components/SimulationResults.tsx:27-29` — divs com `animate-pulse rounded-xl bg-card` violam a regra explícita ("Use `Skeleton` for loading states — never custom `animate-pulse` divs"). Detalhe agravante: `bg-card` pulsando sobre `bg-background` tem contraste quase nulo em light mode — o usuário mal percebe que há loading.
**Fix:** trocar por `<Skeleton className="h-32 rounded-xl" />` (mesmo footprint, uma linha por bloco).

#### P2 — Micro-labels de 10px em uppercase
`PmeSimulatorContainer.tsx:98,103,108` — "VIDAS/FAIXAS/HOSPITAL" em `text-[10px] uppercase tracking-widest`. 10px está abaixo do piso confortável de leitura; a escala do DESIGN.md §4 para em 14px de UI action. Como são labels de dados críticos para a venda, suba para `text-xs`.

#### P2 — Copy sem acento
`PmeSimulatorContainer.tsx:47` — "O Simulador de Planos esta disponível" → "está".

### Recomendações
1. Substituir os pulses custom por `Skeleton` (loading.tsx + SimulationResults).
2. Subir os micro-labels para `text-xs` e corrigir a acentuação.

---

## 4. Calendar (`app/[supabaseId]/calendar/`)

### Nota: 6,0 / 10

**Impressão geral.** O `loading.tsx` é o melhor do app — reproduz fielmente o layout de duas colunas com skeletons proporcionais (`calendar/loading.tsx:6-50`). Mas a página inteira delega para `components/calendar-studio.tsx`, um monólito de **1.632 linhas fora da estrutura `features/`** — sem context, sem service isolado, sem componentes presentacionais separados. É a única das 13 rotas que ignora a arquitetura page-local, e o tamanho do arquivo é onde as violações se acumulam sem revisão.

### Achados

#### P1 — Cores de RSVP em raw Tailwind
`components/calendar-studio.tsx:142-144` — `accepted/declined/tentative` mapeados para `border-green-500 bg-green-500/10 text-green-600` (e red/yellow). É exatamente o caso de uso dos tokens `--semantic-success/-danger/-warning` com o padrão tinted documentado no DESIGN.md §9 (badgeVariants). `:1265` repete `border-red-500... text-red-500` num Badge, e `:1431-1432` usa `after:bg-orange-500/80` e `after:bg-red-500/80 animate-pulse` para indicadores.
**Fix:** mapear para `border-semantic-success-border bg-semantic-success-surface text-semantic-success` etc.

#### P1 — Botão destrutivo com vocabulário inventado
`calendar-studio.tsx:1591` — `border-foreground/20 hover:border-red-400 border-1 bg-transparent hover:bg-red-500 text-red-500/90 hover:text-white` é um quinto estilo de botão destrutivo que não existe em nenhum outro lugar do produto (register product: "if the save button looks different in two places, one is wrong" — vale dobrado para deletar).
**Fix:** `<Button variant="destructive">` ou `variant="outline"` + `text-destructive`.

#### P2 — Monólito fora da arquitetura de features
`components/calendar-studio.tsx` (1.632 linhas) — mover para `app/[supabaseId]/calendar/features/` com container/context/services. Não é só governança: é a razão pela qual os raws acima passaram despercebidos.

#### P2 — `animate-pulse` infinito em eventos atrasados
`calendar-studio.tsx:1236-1239` — mesmo padrão do CRM (ver achado do CRM); resolver junto.

### Recomendações
1. Migrar as cores de RSVP e indicadores para tokens `--semantic-*` (mapa central, ~10 linhas).
2. Trocar o botão destrutivo custom por `variant="destructive"`.
3. Planejar a quebra do monólito em `features/` (pode ser incremental).

---

## 5. Docs (`app/[supabaseId]/docs/`)

### Nota: 7,0 / 10

**Impressão geral.** Estrutura de leitura correta: sidebar fixa no desktop com tint sutil de primary (`DocsContainer.tsx:142` — bom uso de `color-mix` com token), `Drawer` com título para navegação mobile (`:104-138`, compliance com a regra de Title), sincronização com hash da URL e scroll-to-top na troca de capítulo. O indicador ativo do índice com `border-l-[3px] border-l-primary` (`DocsIndex.tsx:144-147`) é padrão legítimo de navegação — não confundir com o ban de side-stripe em cards.

### Achados

#### P1 — `space-y-*` em 15 pontos do capítulo
`features/components/DocsChapterSection.tsx:126,136,161,163,175,188,211,255,333,335,351,393,421,456,458` — o componente inteiro é montado com `space-y-*` em vez de `gap-*`. É a maior concentração da violação no app.
**Fix:** busca-e-substitui por `flex flex-col gap-*` (mecânico; nenhuma mudança visual).

#### P2 — Eyebrows uppercase repetidos em toda seção
`DocsChapterSection.tsx:220,422,476` e `DocsContainer.tsx:107` — `uppercase tracking-[0.18em~0.24em]` como abridor de praticamente toda subseção. Um eyebrow é ferramenta; em toda seção vira o tell de IA que o Impeccable bane ("eyebrows uppercase em toda seção"). Ironia: a documentação ensina o produto com a estética que o produto proíbe.
**Fix:** manter o eyebrow só no header do capítulo; subseções usam peso/tamanho (`text-sm font-semibold`).

#### P2 — Copy sem acentos na navegação
`DocsContainer.tsx:107,111,117,123` — "Capitulo atual", "Documentacao", "Capitulos". Numa página cujo produto é texto, acentuação errada mina a credibilidade do conteúdo.

#### P2 — Tabela interna com header 10-11px uppercase
`DocsChapterSection.tsx:220` — `text-xs uppercase tracking-[0.18em]` em `th` de tabela de referência; com tracking largo a linha fica mais larga que o conteúdo. Reduzir tracking para o default e manter `text-xs font-medium`.

### Recomendações
1. Migração mecânica `space-y-*` → `gap-*` no `DocsChapterSection`.
2. Corrigir acentuação da navegação e reduzir eyebrows a 1 por capítulo.

---

## 6. Performance (`app/[supabaseId]/performance/`)

### Nota: 5,0 / 10

**Impressão geral.** A página tem a direção visual mais ambiciosa do app (KPIs com sparklines, rankings, medalhas) e o `KpiCard` até usa tokens via `color-mix` (`Components/KpiCard.tsx:30-56`) — mas constrói tudo com um dialeto próprio: cards custom em vez de `Card`, escala tipográfica arbitrária (`text-[26px]`, `text-[34px]`, `text-[12.5px]`, `text-[11.5px]`, `text-[11px]`) que ignora a escala do DESIGN.md §4, e opacidades de texto (`text-foreground/45`, `/35`) em vez de `text-muted-foreground`. O resultado parece um protótipo de outro designer enxertado no produto.

### Achados

#### P0 — Banner de erro ilegível em light mode
`features/container/PerformanceContainer.tsx:128` — `border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300`. `text-red-300` sobre fundo claro com tint vermelho de 10% tem contraste na casa de 1,5:1 — o usuário **não consegue ler a mensagem de erro** exatamente no momento em que mais precisa dela (WCAG 1.4.3; Nielsen #9).
**Fix:** `Alert variant="destructive"` (uma linha) ou `text-semantic-danger` sobre `bg-semantic-danger-surface`.

#### P1 — "Ultima atualizacao: ha 2 min" é hardcoded
`PerformanceContainer.tsx:98-100` — o chip de frescor dos dados exibe literalmente a string `"ha 2 min"` sem cálculo algum. Numa página de ranking comercial usada para cobrança de meta, informação de frescor **falsa** é quebra de confiança (product slop test: o usuário fluente pausa e desconfia de todos os números).
**Fix:** calcular a partir do timestamp real da resposta, ou remover o chip até existir o dado. Corrigir acentuação junto.

#### P1 — Skeletons custom com `animate-pulse` em três componentes
`Components/PerfKpis.tsx:16`, `Components/PerfTopHighlights.tsx:21`, `Components/PerfRankings.tsx:118` — divs `animate-pulse` com alturas mágicas (`h-30`, `h-[180px]`, `h-75`) em vez de `Skeleton`.
**Fix:** substituir por `Skeleton` mantendo as dimensões.

#### P1 — Texto de rodapé e helpers abaixo do contraste mínimo
`PerformanceContainer.tsx:136` (`text-foreground/35`), `:53` (`/55`), `KpiCard.tsx:89` (`/45`) — em light mode, foreground a 35-45% de opacidade fica abaixo de 4.5:1. `text-muted-foreground` existe justamente para ser o piso auditado de contraste.
**Fix:** substituir opacidades `/35`-`/55` por `text-muted-foreground`.

#### P2 — Hex nas medalhas
`Components/MedalBadge.tsx:8-10` — ouro/prata/bronze em hex literal. Defensável (cores de medalha não são temáveis), mas merece comentário explicando a exceção para não virar precedente.

#### P2 — Escala tipográfica paralela
`PerformanceContainer.tsx:50,53,98,136`, `KpiCard.tsx:77,84,89` — sete tamanhos arbitrários. Mapear para a escala do projeto (`text-2xl/3xl` para KPI, `text-xs`/`text-sm` para apoio).

#### P2 — Copy sem acento em toda a página
`:35` "ultimas 24h", `:99` "Ultima atualizacao... ha 2 min", `:107` "Exportar relatorio", `:137-138` "reunioes... periodo".

### Recomendações
1. Corrigir o banner de erro (P0) — literalmente trocar por `Alert variant="destructive"`.
2. Remover ou implementar de verdade o chip "há X min".
3. Aproximar a página do design system: `Skeleton`, `text-muted-foreground`, escala tipográfica padrão.

---

## 7. WhatsApp (`app/[supabaseId]/whatsapp/`)

### Nota: 8,5 / 10

**Impressão geral.** A página mais disciplinada do app. Estados cobertos por completo: skeleton de inbox no loading, `NoConfigState` exemplar que diagnostica o status da conexão ("desconectado/banido/aguardando QR") e aponta a próxima ação com botão direto para configurações (`features/components/NoConfigState.tsx:15-49`) — é o empty state que o register product pede ("teach the interface"). Banner de sync histórico com auto-expiração de 30min (`WhatsAppInboxContainer.tsx:13-21`), badge de conexão sempre visível no header da conversa, `Avatar` com `AvatarFallback`, paginação de mensagens antigas com lock de request (`MessagePanel.tsx:164-179`). O pulso vermelho na gravação de áudio (`WhatsAppAudioRecordingBar.tsx:42`) é motion comunicando estado de verdade.

### Achados

#### P2 — `dark:` manuais para o fundo do chat
`features/components/MessagePanel.tsx:144-152` — três overrides `dark:` para trocar as texturas PNG do fundo do chat. É a exceção aceitável da regra (assets raster não respondem a token), mas merece comentário; alternativa futura: uma única textura neutra com `opacity` controlada por token.

#### P2 — Empty state do painel é passivo
`MessagePanel.tsx:57-66` — "Selecione uma conversa" é correto mas perde a chance de orientar ("ou inicie uma nova conversa" apontando para o `NewConversationDialog` que já existe).

### Recomendações
1. Enriquecer o empty state do painel com a ação de nova conversa.
2. Usar esta página como referência interna de estados (loading/empty/error) para as demais.

---

## 8. Carteira (`app/[supabaseId]/carteira/`)

### Nota: 7,0 / 10

**Impressão geral.** Container maduro: tabs Clientes/Renovações com badge de contagem, customização de colunas com drag-and-drop e persistência por usuário (`CarteiraContainer.tsx:159-230` — flexibilidade de power user rara em CRMs), `CarteiraStatsRow` é o padrão-ouro de cards de métrica do app (tokens semânticos no valor, `Skeleton`, `size-*`, tooltips por métrica — `CarteiraStatsRow.tsx:87-129`). A dívida está concentrada nos mapas de cor e no modal de detalhe.

### Achados

#### P1 — Mapa de cores de operadoras em raw Tailwind ignorando os tokens `--sim-op-*`
`features/context/CarteiraTypes.ts:22-27` — Hapvida/Unimed/Amil/Bradesco/SulAmérica/Porto mapeados para `bg-green-100 text-green-800 ... dark:bg-green-900/30 ...` (42 classes raw + `dark:` manuais). O DESIGN.md §9 define tokens **específicos para essas mesmas operadoras** (`--sim-op-hapvida-bg/fg` etc.), que o PME Simulador já consome (`pme-simulador/features/components/PlanResultCard.tsx:13-21`). A mesma seguradora tem uma cor no simulador e outra na carteira — inconsistência de vocabulário no coração do domínio.
**Fix:** trocar o mapa por `bg-[var(--sim-op-hapvida-bg)] text-[var(--sim-op-hapvida-fg)]` etc.; elimina os 42 raws e os `dark:` de uma vez.

#### P1 — Status de renovação com `bg-blue-500` raw
`features/container/CarteiraRenovacoesView.tsx:101,109` e `features/components/RenewalStatusSelect.tsx:28` — `contacted` usa `bg-blue-500`/`text-blue-500` em vez de `--semantic-info`; `CarteiraTypes.ts:32` repete no badge.
**Fix:** `bg-semantic-info` / padrão tinted com `semantic-info-surface`.

#### P2 — Modal de detalhe esconde o botão de fechar padrão
`features/components/CarteiraDetailModal.tsx:390` — `[&>button]:hidden` remove o close default do `DialogContent` num modal de 92vw. Há `handleClose` interno e Esc funciona, mas o affordance visível de saída depende de um botão custom dentro do layout — se ele rolar para fora da dobra, o usuário fica sem saída óbvia (Nielsen #3).
**Fix:** manter o close default ou garantir botão de fechar fixo no header do card esquerdo.

#### P2 — `space-y-6` no corpo do modal
`CarteiraDetailModal.tsx:422` (e mais 6 ocorrências no arquivo) — trocar por `gap-*`.

#### P2 — Botão de presets duplicado do CRM com `orange-500`
`features/container/CarteiraFiltersBar.tsx:421-423` — ver achado do CRM; corrigir nos dois via componente compartilhado.

### Recomendações
1. Migrar o mapa de operadoras para os tokens `--sim-op-*` (consistência com o simulador é ganho de marca interna).
2. Trocar `bg-blue-500` de `contacted` por `--semantic-info`.
3. Restaurar o close visível do modal de detalhe.

---

## 9. Email · Templates (`app/[supabaseId]/email/templates/`)

### Nota: 8,0 / 10

**Impressão geral.** Fluxo de listagem bem resolvido: tabs com contadores por status de aprovação, busca com ícone, skeleton cards que reproduzem a proporção real do grid (`TemplatesContainer.tsx:23-37`), empty state que distingue "busca sem resultado" de "categoria vazia" e orienta a criação (`:39-55`), botão de criação com lock de navegação (`:108-121`). Grid responsivo correto (1→2→3→4 colunas).

### Achados

#### P2 — Tab bar custom diverge do vocabulário das páginas irmãs
`TemplatesContainer.tsx:134-162` — tabs sublinhadas feitas à mão (com `after:` pseudo-elemento), enquanto Campanhas usa pills custom e Carteira usa `Tabs` do shadcn. Três dialetos para o mesmo padrão.
**Fix:** padronizar no `Tabs` do shadcn (que já suporta o visual de underline via estilo).

#### P2 — Hex no workspace do editor
`[id]/features/components/EditorHtmlWorkspace.tsx:98` — `bg-[#05050A]` no skeleton do preview. Defensável (canvas de e-mail renderizado tem fundo próprio), mas use `bg-black/95` ou um token dedicado com comentário. `:20` (hex dentro do HTML gerado para o iframe) é falso positivo — e-mail não herda tokens do app.

#### P2 — Empty state cita rótulo de botão que pode divergir
`TemplatesContainer.tsx:49` — 'Crie seu primeiro template clicando em "+ Criar Template"' referencia o texto do botão por string; se o rótulo mudar, a instrução quebra. Preferir um botão real no empty state.

### Recomendações
1. Adotar `Tabs` shadcn como padrão único de tabs (junto com Campanhas).
2. Colocar botão de ação real no empty state.

---

## 10. Email · Configurações (`app/[supabaseId]/email/configuracoes/`)

### Nota: 6,5 / 10

**Impressão geral.** Organização de conteúdo boa (cards por domínio de configuração, uso real de `FieldGroup` nos cards de formulário) e a barra de salvar sticky com resumo (`EmailSettingsContainer.tsx:57-78`) é ótima ergonomia para uma página longa. O problema é o header-herói, que importa a estética da landing para dentro do produto.

### Achados

#### P1 — Header com radius de 28px, gradiente e sombra premium numa tela de configurações
`features/container/EmailSettingsContainer.tsx:18` — `rounded-[1.75rem]` (28px) viola o ban absoluto do Impeccable (border-radius 24px+ em cards) e o DESIGN.md §5 ("Do not use giant radius"); soma `bg-[linear-gradient(...)]` + `border` + `shadow-[var(--precision-shadow-2)]` (borda 1px + sombra larga juntos, outro ban), num register onde o DESIGN.md §6 pede "border-only depth for dense data areas" e reserva sombra cromática para "premium CTAs". É decoração de brand numa superfície de tarefa.
**Fix:** header plano — título + descrição + card "Resumo rápido" à direita, `rounded-xl`, sem gradiente/sombra.

#### P1 — Heading com `clamp()` fluido em UI de produto
`EmailSettingsContainer.tsx:26` — `text-[clamp(1.625rem,2vw,2rem)]`. O register product pede escala rem fixa ("a fluid h1 that shrinks in a sidebar looks worse, not better"); nenhuma outra página do app usa clamp em headings.
**Fix:** `text-2xl` ou `text-3xl` fixo, coerente com "Templates"/"Campanhas"/"Carteira".

#### P2 — Ícone decorativo de 56px no header
`:21-23` — `size-14 rounded-2xl bg-primary/10` com ícone de engrenagem é ornamento que empurra o conteúdo real para baixo. Se o header ficar plano (fix acima), remover junto.

#### P2 — Sticky bar com `z-10`
`:57` — `z-index` manual; funciona, mas se sobrepor a popovers/tooltips o débito aparece. Validar contra os overlays do shadcn.

### Recomendações
1. Achatar o header-herói (radius ≤ `rounded-xl`, sem gradiente+sombra) e fixar o heading em `text-2xl`.
2. Manter a sticky bar — é o melhor padrão de save do app; considerar replicá-la em outras telas de configuração.

---

## 11. Lead Transfers (`app/[supabaseId]/lead-transfers/`)

### Nota: 8,0 / 10

**Impressão geral.** Tabela de referência: badges de estado no padrão tinted correto dos tokens (`LeadTransfersTable.tsx:77-91` — `border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning`, exatamente como o DESIGN.md §9 prescreve), avatares com fallback e tooltip com nome completo, skeleton por linhas, paginação completa, guard de acesso com card explicativo (`LeadTransfersContainer.tsx:90-106`) e clique na linha abrindo o `LeadDialog` com feedback de loading e toast de erro. Header conta o total ("N transferências") — status do sistema sempre visível.

### Achados

#### P2 — Empty state sem orientação
`LeadTransfersTable.tsx:138` — "Nenhuma transferência encontrada." numa célula de tabela. Correto, mas quando há filtros ativos deveria oferecer "Limpar filtros" (o corretor não distingue "não existe" de "meu filtro escondeu").

#### P2 — Skeleton de loading não inclui o header da tabela
`LeadTransfersTable.tsx:100-108` — 8 barras genéricas; ao carregar, a estrutura salta para tabela com header. Skeleton com header fixo + linhas reduz o layout shift percebido.

### Recomendações
1. Empty state condicional com ação de limpar filtros.
2. Usar os badges desta página como exemplo canônico ao refatorar Dashboard/Calendar.

---

## 12. Email · Contatos (`app/[supabaseId]/email/contatos/`)

### Nota: 6,0 / 10

**Impressão geral.** O layout master-detail (painel de listas à esquerda, contatos à direita) é a escolha certa de IA, com empty state adequado quando nenhuma lista está selecionada (`ContatosContainer.tsx:45-51`). Mas o layout não tem plano para telas pequenas e as cores de status fogem dos tokens.

### Achados

#### P1 — Duas colunas fixas sem colapso mobile
`features/container/ContatosContainer.tsx:32-44` — `flex gap-6` com sidebar `w-64 shrink-0` e `Separator` vertical, sem nenhum breakpoint. Em <768px sobram ~380px para a tabela de contatos (que tem e-mail, telefone, status, ações) — overflow horizontal inevitável. Compare com o Docs, que resolve o mesmo problema com `Drawer` no mobile (`DocsContainer.tsx:104-138`).
**Fix:** `flex-col lg:flex-row`, com o painel de listas virando `Select` ou `Drawer` abaixo de `lg`.

#### P1 — Badge de status e ação destrutiva com cores raw
`features/components/ContactsTable.tsx:50` — Badge "Ativo" com `bg-emerald-500/15 text-emerald-700` em vez do padrão tinted `--semantic-success`; `:90` usa `text-red-600` em item de menu destrutivo em vez de `text-destructive`.
**Fix:** `bg-semantic-success-surface text-semantic-success border-semantic-success-border` e `text-destructive`.

#### P2 — `space-y-*` no container e sub-painéis
`ContatosContainer.tsx:19,34,44` (+ `ContactListPanel.tsx`, `ContactAddModal.tsx`) — trocar por `gap-*`.

#### P2 — Eyebrow "LISTAS" em uppercase tracking
`ContatosContainer.tsx:35` — isolado, aceitável; se padronizar os eyebrows do app (ver Docs), incluir este.

### Recomendações
1. Implementar o colapso responsivo do painel de listas (é a única página do escopo com layout duro em duas colunas).
2. Migrar badge/ação destrutiva para tokens semânticos.

---

## 13. Email · Campanhas (`app/[supabaseId]/email/campanhas/`)

### Nota: 7,0 / 10

**Impressão geral.** Boa página operacional: barra de créditos sempre visível no topo com barra de progresso e aviso de saldo baixo, banner de progresso de disparo, tabs de status com scroll horizontal (`CampanhasContainer.tsx:63-77` — único tab bar do app que pensou em overflow), wizard/edição/analytics em dialogs separados. O `loading.tsx` de 65 linhas cobre a estrutura real.

### Achados

#### P1 — Aviso de créditos em `amber-*` raw com `dark:` manuais
`features/components/CreditBalanceBar.tsx:38-41` — `border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30` + `text-amber-600/800/200` para o estado "sem créditos"; `:70,76` repetem `text-amber-600`/`bg-amber-500` para saldo baixo. É o caso literal dos tokens `--semantic-warning(-surface/-border)`, que se auto-adaptam ao dark mode sem override algum.
**Fix:** `border-semantic-warning-border bg-semantic-warning-surface` + `text-semantic-warning`; barra de progresso `bg-semantic-warning` quando `isLow`.

#### P2 — Tabs pill custom com ternário manual
`CampanhasContainer.tsx:68-72` — template literal em vez de `cn()`, e terceiro dialeto de tabs do app (ver achado sistêmico). Além disso são `<button>` crus sem `aria-pressed`/`role="tab"` — teclado navega, mas leitor de tela não anuncia seleção.
**Fix:** `Tabs` do shadcn resolve estilo, `cn()` e acessibilidade de uma vez.

#### P2 — Barra de progresso de créditos sem semântica ARIA
`CreditBalanceBar.tsx:74-79` — div com width%; usar o componente `Progress` do shadcn (role="progressbar" nativo).

### Recomendações
1. Migrar `CreditBalanceBar` para tokens `--semantic-warning` (remove 5 raws + 3 `dark:`).
2. Unificar tabs no componente shadcn (junto com Templates).

---

## Veredito de anti-padrões (visão geral)

**O app parece gerado por IA?** Em geral, **não** — a maioria das páginas passa no product slop test com vocabulário shadcn consistente, empty states que orientam e aceleradores reais (presets de filtro, colunas customizáveis). As exceções que puxam para "template": o **Dashboard** (grid de cards-gradiente com 4 accents + emojis — o tell mais forte do escopo), o header-herói de **Email Configurações** (radius 28px + gradiente + sombra premium) e os eyebrows em série do **Docs**. Nenhuma página usa gradient text, glassmorphism decorativo ou side-stripes em cards.

**Onde o sistema funciona:** Lead Transfers, WhatsApp, PME Simulador e a `CarteiraStatsRow` provam que os tokens `--semantic-*`/`--sim-op-*` cobrem 100% dos casos de status/operadora — todas as ~200 ocorrências de cores raw do escopo têm substituto direto já documentado no DESIGN.md §9.

**Prioridade transversal sugerida:** (1) P0s — banner de erro do Performance e grid fixo do Dashboard; (2) reescrita da Seção 1 do Dashboard no padrão `CarteiraStatsRow`; (3) varredura mecânica de cores raw → tokens (Carteira, Calendar, Campanhas, Contatos, CRM); (4) skeletons custom → `Skeleton`; (5) unificação de tabs e do botão de presets.
