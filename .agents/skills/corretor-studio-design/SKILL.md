---
name: corretor-studio-design
description: Gera direção visual e especificação de implementação para interfaces do Corretor Studio, seguindo o contrato canônico do DESIGN.md, os tokens do globals.css e os padrões shadcn/ui via MCP. Use antes de implementar qualquer tela, modal, formulário, seção ou componente visual novo no projeto lead-flow-app.
---

# Corretor Studio Design

Produz um **design brief estruturado** e um **checklist de conformidade** antes de qualquer implementação visual no Corretor Studio (lead-flow-app).

## Processo obrigatório (5 passos)

1. Ler as fontes canônicas
2. Consultar shadcn via MCP
3. Interpretar o briefing
4. Compor tokens, layout e componentes
5. Entregar brief JSON + checklist

---

## Passo 1 — Ler as fontes canônicas

Antes de qualquer decisão visual, ler nesta ordem:

| Prioridade | Fonte | O que extrai |
|---|---|---|
| 1 | `DESIGN.md` | Tokens, tipografia, superfícies, motion, anti-padrões |
| 2 | `app/globals.css` | Classes utilitárias de landing, regiões gerenciadas |
| 3 | `agents.md` (seção Visual Implementation) | Regras obrigatórias de shadcn e design:check |

Se houver conflito entre decisões visuais anteriores e o `DESIGN.md`, **prevalece o `DESIGN.md`**.

Regiões gerenciadas em `globals.css` (nunca editar manualmente):
- `/* TOKENS:THEME_INLINE:START/END */`
- `/* TOKENS:ROOT:START/END */`
- `/* TOKENS:DARK:START/END */`

Para atualizar tokens: `bun run design:sync`. Para validar: `bun run design:check`.

---

## Passo 2 — Consultar shadcn via MCP

**MUST** executar antes de criar qualquer componente visual. Sequência obrigatória:

```
1. shadcn:search_items_in_registries  → buscar o componente pelo nome
2. shadcn:view_items_in_registries    → inspecionar API completa e variantes
3. shadcn:get_add_command_for_items   → obter o comando de instalação
4. Instalar com: bunx --bun shadcn@latest add <componente>
```

Só criar markup customizado se o componente **não existir** no registry.

**Nunca** instalar com npm ou yarn. Sempre usar `bunx --bun shadcn@latest`.

---

## Passo 3 — Interpretar o briefing

Extrair ou confirmar estes campos antes de propor a solução:

| Campo | Descrição |
|---|---|
| `tipo_tela` | landing, dashboard, seção, modal, formulário, fluxo |
| `objetivo_conversao` | ação principal que deve acontecer |
| `publico` | manager, operator, backoffice, lead, visitante |
| `restricoes` | técnicas, de conteúdo, prazo, compliance, acessibilidade |

Se algum campo estiver ausente, assumir o mínimo necessário e declarar as assunções explicitamente no campo `assuncoes` do JSON de saída.

---

## Passo 4 — Compor tokens, layout e componentes

### Tokens semânticos (usar sempre, nunca hex hardcoded)

| Namespace | Uso |
|---|---|
| `--surface-0` a `--surface-4` | Camadas de profundidade da página |
| `--primary` / `--primary-foreground` | Laranja de marca, CTAs primários |
| `--precision-indigo` / `--precision-*` | Ênfase fintech, bordas de destaque |
| `--semantic-success/warning/danger/info/new` | Status e intenção |
| `--motion-duration-*` / `--motion-ease-*` | Animações e transições |
| `--muted-foreground` | Texto secundário |
| `bg-primary`, `text-muted-foreground` | Classes Tailwind semânticas |

### Regras de composição shadcn (MUST)

- Usar `FieldGroup` + `Field` em todos os formulários. Nunca `div` com `space-y-*`.
- Usar `gap-*` em vez de `space-y-*` ou `space-x-*`.
- Usar `size-*` quando largura e altura forem iguais.
- Usar `cn()` de `@/lib/utils` para classes condicionais.
- Ícones dentro de `Button`: usar `data-icon="inline-start"` ou `data-icon="inline-end"`. Sem `size-4`, `w-4`, `h-4` em ícones dentro de componentes shadcn.
- Biblioteca de ícones: `lucide-react` (primária), `@tabler/icons-react` (secundária).
- `Avatar` sempre com `AvatarFallback`.
- `Dialog`, `Sheet` e `Drawer` sempre com `Title` (usar `sr-only` se visualmente oculto).
- `Skeleton` para estados de loading — nunca `animate-pulse` manual.
- `Badge` para indicadores de status — nunca `span` customizado.
- `Separator` em vez de `<hr>` ou `<div className="border-t">`.
- `sonner` para notificações toast — nunca `alert` nativo.
- Nunca adicionar `z-index` manual em `Dialog`, `Sheet`, `Drawer`, `Popover`, `Tooltip`.
- Nunca usar `dark:` manual para cores — tokens semânticos já lidam com light/dark.

### Linguagem visual do Corretor Studio

- **DNA visual**: Hybrid Warm-Precision (laranja Zapier + precisão Stripe + superfícies Linear).
- **Tipografia**: `Poppins` para headings e app; `Inter` para landing page.
- **Botões**: `primary` (laranja, `rounded-2xl`, sombra forte); `secondary` (neutro, borda); `ghost` (mínimo); `pill-cta` (apenas em hero/pricing/checkout).
- **Cards**: `feature` (borda + superfície suave); `feature-featured` (borda cromática + elevação); `stats` (número centralizado); `technical-panel` (dados e integrações).
- **Layout**: `max-w-7xl`, bento assimétrico (`col-span-2 + col-span-1`), seções `py-20 md:py-28`, cards `p-6`/`p-8`/`p-10`.

### Anti-padrões (MUST NOT)

- Hex hardcoded em JSX/TSX para UI tematizável.
- Editar manualmente regiões gerenciadas de tokens em `globals.css`.
- Mais de dois acentos cromáticos concorrentes em um componente.
- Grid uniforme repetitiva sem hierarquia de conversão.
- Motion contínuo decorativo sem função.
- Raio e sombra idênticos em todos os cards.
- Contraste insuficiente em estados de foco/hover/disabled.

---

## Passo 5 — Entregar brief JSON + checklist

Ver template completo em `templates/design-brief.template.json`.

Responder sempre com dois blocos:

**1. `design_brief_json`** — preenchido com os dados reais do briefing.

**2. `checklist_conformidade`**:
- [ ] Usa tokens semânticos (sem hex hardcoded em UI tematizável)
- [ ] Tipografia `Poppins + Inter` respeitada
- [ ] Componentes shadcn consultados via MCP antes de criar markup
- [ ] CTA primário com hierarquia inequívoca
- [ ] Light/dark consistentes com o contrato do `DESIGN.md`
- [ ] Motion usa `--motion-*` e respeita `prefers-reduced-motion`
- [ ] Sem edição manual de regiões gerenciadas por `design:sync`
- [ ] `bun run design:check` passa após qualquer alteração de UI

---

## Validação pós-implementação

Após qualquer alteração de UI, executar obrigatoriamente:

```bash
bun run typecheck 2>&1 | head -20
bun run lint
bun run governance:check
bun run design:check
```

Se `design:check` falhar, executar `bun run design:sync` e commitar o resultado.
