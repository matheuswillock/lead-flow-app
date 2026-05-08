# Briefing de Design — Página Performance

> **Projeto:** Corretor Studio (lead-flow-app)
> **Branch:** `Features/performance-page-redesign` (baseada em `develop`)
> **Data:** 2026-05-08
> **Responsável:** Manus AI

---

## 1. Contexto e Objetivo

A página **Performance** é um dashboard comercial destinado a **managers** e **closers**, exibindo indicadores de vendas, reuniões, agendamentos, taxa de no-show, destaques de top performers e rankings de SDRs e Closers. O objetivo central é oferecer uma visão analítica clara e hierárquica dos indicadores comerciais do time.

A implementação atual existe e funciona, mas não segue o padrão visual definido no mockup entregue pelo Claude Design. Este briefing especifica as mudanças necessárias para alinhar a implementação ao design system do Corretor Studio.

---

## 2. Diagnóstico da Implementação Atual

A implementação atual apresenta os seguintes desvios em relação ao mockup:

| Componente | Estado Atual | Estado Esperado |
|---|---|---|
| **Cabeçalho da página** | Título simples `text-xl font-semibold` | Título grande com subtítulo dinâmico (período ativo), botões "Exportar relatório" e "Nova meta" |
| **Barra de filtros** | Funcional, mas sem estilo de preset agrupado | Presets agrupados em container com borda, filtros SDR/Closer com chip dashed, busca com ícone integrado |
| **Cards de KPI** | 2 cards simples (Vendas + Receita) | 4 cards com ícone colorido, valor grande, helper text, sparkline Recharts e delta de variação |
| **Top Performers** | Ausente | 2 cards destacados (Top Closer e Top SDR) com avatar, nome, role, valor e taxa de presença |
| **Rankings** | Tabela simples sem avatar, sem barra de progresso | Lista com avatar colorido, posição ranqueada (ouro/prata/bronze), barra de progresso, valor com sufixo |
| **Tabela de vendas** | Funcional e completa | Mantida, mas com ajuste de padding e tipografia |

---

## 3. Estrutura de Dados (Supabase + Backend)

O backend já retorna todos os dados necessários via `GET /api/v1/performance/sales`. A estrutura `PerformanceSalesResult` contém:

| Campo | Tipo | Uso na UI |
|---|---|---|
| `kpis.closedSales` | `number` | Card "Vendas fechadas" |
| `kpis.meetingsHeld` | `number` | Card "Reuniões realizadas" |
| `kpis.scheduledLeads` | `number` | Card "Agendamentos realizados" |
| `kpis.noShowRate` | `number` | Card "Taxa de no-show" |
| `kpis.noShowCount` | `number` | Helper text do card no-show |
| `highlights.topCloser` | `PerformanceHighlight` | Card "Top Closer do Mês" |
| `highlights.topSdr` | `PerformanceHighlight` | Card "Top SDR do Mês" |
| `rankings.closer` | `PerformanceRankingEntry[]` | Ranking de Closers |
| `rankings.sdr` | `PerformanceRankingEntry[]` | Ranking de SDRs |
| `rankings.*.meetingsHeld` | `number` | Subtexto do ranking (reuniões realizadas) |
| `rankings.*.attendanceRate` | `number` | Subtexto do ranking (% presença) |
| `rows` | `PerformanceSaleRow[]` | Tabela de vendas |
| `pagination` | `PerformancePagination` | Paginação da tabela |

> **Importante:** O `PerformanceTypes.ts` no frontend já está sincronizado com o backend. Os campos `kpis`, `highlights`, `rankings` e `drilldown` estão corretamente tipados em `PerformanceData`.

---

## 4. Tokens de Design a Utilizar

Todos os valores de cor devem usar **tokens semânticos** do `globals.css`. Nenhum hex hardcoded é permitido em JSX/TSX.

| Elemento | Token |
|---|---|
| Fundo da página | `bg-background` |
| Fundo dos cards | `bg-card` |
| Borda dos cards | `border-border` |
| Texto primário | `text-foreground` |
| Texto secundário | `text-muted-foreground` |
| Ícone/acento de Vendas | `var(--primary)` → `text-primary` |
| Ícone/acento de Reuniões | `var(--semantic-info)` |
| Ícone/acento de Agendamentos | `var(--semantic-success)` |
| Ícone/acento de No-show | `var(--semantic-warning)` |
| Barra de progresso — Closer | `bg-primary` |
| Barra de progresso — SDR | `bg-[var(--semantic-info)]` |
| Delta positivo | `text-[var(--semantic-success)]` |
| Delta negativo (bom para no-show) | `text-[var(--semantic-success)]` |
| Delta negativo (ruim) | `text-[var(--semantic-danger)]` |

---

## 5. Componentes shadcn/ui a Usar

Todos os componentes abaixo já estão instalados no projeto (`/components/ui/`). Não instalar novos sem verificar via MCP.

| Componente | Uso |
|---|---|
| `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardAction` | KPI cards, Top Performer cards, Ranking cards |
| `Avatar`, `AvatarFallback` | Avatar de usuários nos rankings e highlights |
| `Badge` | Tags de role (SDR, CLOSER) e status |
| `Button` | Presets, Exportar, Nova meta, Limpar |
| `Input` | Campo de busca de cliente |
| `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` | Filtros SDR e Closer |
| `Skeleton` | Loading states de todos os componentes |
| `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` | Tabela de vendas |
| `Separator` | Divisores entre seções (nunca `<hr>` ou `border-t` manual) |
| `ChartContainer` (Recharts) | Sparklines nos KPI cards |

---

## 6. Especificação por Componente

### 6.1 `PerformanceContainer.tsx` — Cabeçalho da Página

**Estrutura esperada:**

```tsx
<div className="flex flex-col gap-6 p-6">
  {/* Header */}
  <div className="flex items-start justify-between">
    <div className="flex flex-col gap-1">
      <h1 className="text-3xl font-bold tracking-tight font-[Poppins]">Performance</h1>
      <p className="text-sm text-muted-foreground">
        Indicadores comerciais e ranking de SDRs e Closers — <span className="font-medium">{presetLabel}</span>
      </p>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Última atualização: há 2 min</span>
      <Button variant="outline" size="sm">
        <Download className="size-4" data-icon="inline-start" /> Exportar relatório
      </Button>
      <Button size="sm">
        <Plus className="size-4" data-icon="inline-start" /> Nova meta
      </Button>
    </div>
  </div>

  <PerformanceFiltersBar />
  {error && <Alert variant="destructive">...</Alert>}
  <PerformanceSummaryCards />
  <PerformanceTopHighlights />
  <PerformanceRankings />
  <PerformanceTable />
</div>
```

---

### 6.2 `PerformanceFiltersBar.tsx` — Barra de Filtros

**Mudanças necessárias:**

Os presets devem ser agrupados em um container com borda e fundo sutil, como no mockup. O preset ativo deve usar `bg-primary text-primary-foreground` com sombra laranja. Os filtros SDR e Closer devem usar `Button` com `variant="outline"` e borda dashed.

```tsx
{/* Presets agrupados */}
<div className="flex items-center gap-1 p-1 rounded-lg border border-border bg-card/50">
  {PRESETS.map((p) => (
    <Button
      key={p.value}
      variant={isActivePreset(p.value) ? 'default' : 'ghost'}
      size="sm"
      className={cn(
        "h-7 px-3 text-xs",
        isActivePreset(p.value) && "shadow-[0_4px_14px_-6px_rgba(245,73,0,0.6)]"
      )}
      onClick={() => setPreset(p.value)}
    >
      {p.label}
    </Button>
  ))}
</div>
```

---

### 6.3 `PerformanceSummaryCards.tsx` — KPI Cards (4 cards)

**Mudanças necessárias:** Expandir de 2 para 4 cards. Adicionar sparklines com Recharts. Adicionar delta de variação. Usar ícone colorido com fundo semântico.

**Estrutura de cada KPI card:**

```tsx
<Card className="relative overflow-hidden">
  <CardHeader className="pb-2">
    <div className="flex items-center gap-2">
      <div
        className="size-8 rounded-lg grid place-items-center"
        style={{
          background: 'color-mix(in oklab, var(--primary) 14%, var(--card))',
          border: '1px solid color-mix(in oklab, var(--primary) 24%, transparent)',
        }}
      >
        <HandshakeIcon className="size-4 text-primary" />
      </div>
      <CardTitle className="text-sm font-medium text-muted-foreground">Vendas fechadas</CardTitle>
    </div>
    {/* Delta */}
    <span className="text-xs font-semibold text-[var(--semantic-success)]">+12.4%</span>
  </CardHeader>
  <CardContent className="pb-2">
    <p className="text-4xl font-bold tracking-tight">47</p>
    <p className="text-xs text-muted-foreground mt-1">R$ 3.124.500 em receita</p>
  </CardContent>
  {/* Sparkline */}
  <div className="px-1 pb-1">
    <ChartContainer config={chartConfig} className="h-12 w-full">
      <AreaChart data={sparkData}>
        <Area dataKey="v" stroke="var(--primary)" fill="none" strokeWidth={1.5} />
      </AreaChart>
    </ChartContainer>
  </div>
</Card>
```

**Os 4 KPI cards:**

| # | Label | Dado | Acento | Ícone |
|---|---|---|---|---|
| 1 | Vendas fechadas | `kpis.closedSales` | `--primary` | `HandshakeIcon` |
| 2 | Reuniões realizadas | `kpis.meetingsHeld` | `--semantic-info` | `CalendarCheck` |
| 3 | Agendamentos realizados | `kpis.scheduledLeads` | `--semantic-success` | `CalendarPlus` |
| 4 | Taxa de no-show | `kpis.noShowRate` + `%` | `--semantic-warning` | `UserX` |

> **Nota sobre sparklines:** Os dados de sparkline não estão disponíveis no backend atual. Para a primeira versão, omitir o sparkline ou usar dados simulados com base no total. A segunda versão pode adicionar endpoint de série temporal.

---

### 6.4 `PerformanceTopHighlights.tsx` — Novo Componente

Este componente **não existe** na implementação atual e deve ser criado. Exibe dois cards lado a lado: Top Closer do Mês e Top SDR do Mês.

**Localização:** `features/container/PerformanceTopHighlights.tsx`

**Dados:** `data.highlights.topCloser` e `data.highlights.topSdr`

```tsx
function TopPerformerCard({ title, highlight, accent }: TopPerformerCardProps) {
  if (!highlight) return null;
  return (
    <Card className="relative overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {title}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">Atualizado agora</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarFallback className="text-sm font-semibold bg-primary/20 text-primary">
              {getInitials(highlight.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-semibold text-base">{highlight.name}</p>
            <p className="text-xs text-muted-foreground">{highlight.roleLabel}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{highlight.value}</p>
            <p className="text-xs text-muted-foreground">{highlight.suffix}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {highlight.attendanceRate.toFixed(0)}% taxa de presença
        </p>
      </CardContent>
    </Card>
  );
}
```

---

### 6.5 `PerformanceRankings.tsx` — Ranking com Barra de Progresso

**Mudanças necessárias:** Substituir a tabela simples por uma lista com avatar, posição ranqueada (medalha ouro/prata/bronze), barra de progresso proporcional ao líder, e valor com sufixo.

**Estrutura de cada linha de ranking:**

```tsx
function RankRow({ rank, entry, maxValue, suffix, barColor }: RankRowProps) {
  const pct = maxValue > 0 ? (entry.count / maxValue) * 100 : 0;
  const medalColors = ['text-yellow-500', 'text-slate-400', 'text-amber-700'];

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/40 transition-colors">
      {/* Posição */}
      <span className={cn("w-5 text-sm font-bold text-center", rank <= 3 ? medalColors[rank-1] : "text-muted-foreground")}>
        {rank}
      </span>

      {/* Avatar */}
      <Avatar className="size-8">
        <AvatarFallback className="text-xs font-semibold">{getInitials(entry.name)}</AvatarFallback>
      </Avatar>

      {/* Nome e subtexto */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{entry.name}</p>
        <p className="text-xs text-muted-foreground">
          {entry.meetingsHeld} reuniões realizadas · {entry.attendanceRate.toFixed(0)}%
        </p>
      </div>

      {/* Valor + barra */}
      <div className="flex flex-col items-end gap-1 min-w-[80px]">
        <span className="text-sm font-bold">
          {entry.count} <span className="text-muted-foreground font-normal text-xs">{suffix}</span>
        </span>
        <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: barColor }}
          />
        </div>
      </div>
    </div>
  );
}
```

**Cabeçalho do card de ranking:**

```tsx
<div className="px-5 pt-4 pb-3 border-b border-border flex items-center justify-between">
  <div className="flex items-center gap-2.5">
    <div className="size-7 rounded-md grid place-items-center bg-primary/15 border border-primary/25">
      <Trophy className="size-3.5 text-primary" />
    </div>
    <div>
      <p className="text-sm font-semibold">Ranking de Closers</p>
      <p className="text-xs text-muted-foreground">por vendas fechadas no período</p>
    </div>
  </div>
  <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
    <Download className="size-3" /> Exportar
  </Button>
</div>
```

---

### 6.6 `PerformanceTable.tsx` — Tabela de Vendas

A tabela está funcional. As mudanças são apenas visuais:

- Adicionar `className="rounded-xl border"` no container da tabela (já usa `rounded-md border`, ajustar para `rounded-xl`).
- Garantir que o `TableHead` use `text-muted-foreground text-xs font-medium uppercase tracking-wider`.
- Adicionar uma linha de rodapé com nota: `"Dados sincronizados com CRM · Apenas vendas e reuniões marcadas como realizadas no período selecionado"`.

---

## 7. Arquivos a Criar/Modificar

| Arquivo | Ação | Prioridade |
|---|---|---|
| `features/container/PerformanceContainer.tsx` | **Modificar** — Novo cabeçalho, adicionar `PerformanceTopHighlights` | Alta |
| `features/container/PerformanceSummaryCards.tsx` | **Modificar** — 4 cards com ícone, sparkline e delta | Alta |
| `features/container/PerformanceTopHighlights.tsx` | **Criar** — Novo componente Top Performer | Alta |
| `features/container/PerformanceRankings.tsx` | **Modificar** — Lista com avatar, medalha e barra de progresso | Alta |
| `features/container/PerformanceFiltersBar.tsx` | **Modificar** — Presets agrupados, chips dashed | Média |
| `features/container/PerformanceTable.tsx` | **Modificar** — Ajustes visuais menores + rodapé | Baixa |

---

## 8. Fluxo de Implementação Recomendado

1. **Criar `PerformanceTopHighlights.tsx`** — componente novo, sem risco de regressão.
2. **Modificar `PerformanceSummaryCards.tsx`** — expandir de 2 para 4 cards com novo layout.
3. **Modificar `PerformanceRankings.tsx`** — substituir tabela por lista com avatar e barra.
4. **Modificar `PerformanceContainer.tsx`** — novo cabeçalho e incluir `PerformanceTopHighlights`.
5. **Modificar `PerformanceFiltersBar.tsx`** — ajustes visuais nos presets e chips.
6. **Ajustes finais em `PerformanceTable.tsx`** — rodapé e tipografia.
7. **Executar validações:** `bun run typecheck && bun run lint && bun run governance:check && bun run design:check`.

---

## 9. Design Brief JSON

```json
{
  "feature_name": "Página de Performance",
  "tipo_tela": "dashboard",
  "objetivo_conversao": "Analisar métricas comerciais e ranking de SDRs e Closers com clareza visual e hierarquia",
  "publico": "manager e closer",
  "restricoes": "Tokens OKLch sem hex hardcoded, next-themes (light/dark), shadcn/ui, Recharts para sparklines",
  "tokens_recomendados": [
    "--primary (Vendas, CTAs)",
    "--semantic-info (Reuniões)",
    "--semantic-success (Agendamentos, delta positivo)",
    "--semantic-warning (No-show)",
    "--semantic-danger (delta negativo)",
    "--surface-2 (fundo de cards)",
    "--muted-foreground (texto secundário)"
  ],
  "componentes_shadcn": [
    "Card, CardHeader, CardTitle, CardContent, CardAction",
    "Avatar, AvatarFallback",
    "Badge",
    "Button",
    "Input",
    "Select, SelectTrigger, SelectContent, SelectItem",
    "Skeleton",
    "Table, TableHeader, TableBody, TableRow, TableHead, TableCell",
    "Separator",
    "ChartContainer (Recharts)"
  ]
}
```

---

## 10. Checklist de Conformidade

- [ ] Usa tokens semânticos (sem hex hardcoded em UI tematizável)
- [ ] Tipografia `Poppins + Inter` respeitada
- [ ] Componentes shadcn consultados via MCP antes de criar markup
- [ ] CTA primário com hierarquia inequívoca
- [ ] Light/dark consistentes com o contrato do `DESIGN.md`
- [ ] Motion usa `--motion-*` e respeita `prefers-reduced-motion`
- [ ] Sem edição manual de regiões gerenciadas por `design:sync`
- [ ] `bun run design:check` passa após qualquer alteração de UI
- [ ] `bun run typecheck` passa
- [ ] `bun run lint` passa
- [ ] `bun run governance:check` passa
- [ ] `Avatar` sempre com `AvatarFallback`
- [ ] `Skeleton` para loading states (nunca `animate-pulse` manual)
- [ ] `Badge` para tags de role (nunca `span` customizado)
- [ ] `gap-*` em vez de `space-y-*` / `space-x-*`
- [ ] `cn()` de `@/lib/utils` para classes condicionais
- [ ] Ícones dentro de `Button` com `data-icon="inline-start"`

---

## 11. Notas sobre Sparklines

O mockup exibe sparklines (mini gráficos de área) em cada KPI card. O backend atual **não retorna série temporal por KPI**. Para implementação imediata, há duas abordagens:

**Opção A (Recomendada para v1):** Omitir sparklines na primeira versão e adicionar um `TODO` no código indicando que será implementado quando o endpoint de série temporal estiver disponível.

**Opção B:** Gerar dados simulados de sparkline com base nos dados disponíveis (ex: distribuição aleatória seeded pelo valor total). Não recomendado para produção.

**Opção C (Ideal para v2):** Adicionar endpoint `GET /api/v1/performance/sparklines?preset=7d` que retorna série temporal diária para cada KPI.

---

*Briefing gerado por Manus AI com base no mockup fornecido, DESIGN.md, schema Supabase e implementação atual do repositório.*
