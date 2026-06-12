---
name: design-system-guard
description: Guardrail do Design System do Corretor Studio para TODA mudança de frontend. Usar SEMPRE que for criar OU alterar qualquer código visual em produção (TSX/JSX, componente, tela, página, modal, formulário, card, tabela, badge, layout, classes Tailwind, estilos, tokens) no lead-flow-app — inclusive em edições pequenas de UI já existente. Garante uso dos tokens semânticos do DESIGN.md/globals.css, componentes shadcn/ui via MCP, ícones Lucide, tipografia Poppins/Inter e validação design:check antes de finalizar.
---

# Design System Guard

Aplica o design system canônico do Corretor Studio a **qualquer alteração de frontend**, seja criação de tela nova ou ajuste de um componente existente. Este skill é um **guardrail**: não substitui a implementação, ele garante que toda mudança visual saia em conformidade com o contrato de design.

## Quando este skill se aplica

Antes de salvar **qualquer** edit que toque código de UI em produção:

- Criar componente, tela, página, modal, formulário, card, tabela, badge, sidebar, layout.
- Editar JSX/TSX existente: trocar texto, ajustar spacing, mudar cor, adicionar ícone, alterar estado visual.
- Mexer em `className` Tailwind, estilos inline ou tokens.

Se o edit não toca UI (apenas lógica de backend, types puros, scripts), este skill **não** se aplica.

## Passo 1 — Identificar a superfície

| Superfície | Onde | Blur/Orbs | Tipografia |
|---|---|---|---|
| **App / CRM** | `app/[supabaseId]/…`, `app/backoffice/…` | ❌ nunca | Poppins |
| **Marketing / Landing** | `app/` (landing, rota `/`) | ✅ permitido | Poppins + Inter |

A escolha de tokens e o uso (ou não) de blur dependem da superfície. Em dúvida, trate como **App** (mais restritivo).

## Passo 2 — Consultar as fontes canônicas (ordem de prioridade)

Em conflito, vence o documento de tokens (`DESIGN.md` > `globals.css` > demais).

1. `DESIGN.md` — contrato normativo de tokens, tipografia, superfícies, motion.
2. `app/globals.css` — tokens `@theme inline` reais já disponíveis no código.
3. `CorretorStudioDesignSystem/README.md` — fundações visuais, cards, botões, voz/copy.
4. `CorretorStudioDesignSystem/ui_kits/app/` — componentes de referência pixel-honest (reutilizar antes de criar do zero).

Para briefs de tela nova, delegar ao skill `corretor-studio-design`. Para arquitetura de feature, ao `corretor-studio-frontend`. Este guardrail foca em **conformidade visual de cada edit**.

## Passo 3 — shadcn primeiro (componente novo)

Antes de escrever markup customizado, consultar o registry via MCP:

```
shadcn:search_items_in_registries → shadcn:view_items_in_registries → shadcn:get_add_command_for_items
bunx --bun shadcn@latest add <componente>
```

Só criar markup próprio quando o componente não existir no registry.

## Regras inegociáveis (MUST)

- **Tokens, nunca hex.** Use `var(--primary)`, `bg-primary`, `text-muted-foreground` — nunca `#ff6900`, `bg-blue-500`, `text-gray-600` em UI temável.
- **Tokens semânticos disponíveis** (de `globals.css`): superfícies `--background`/`--card`/`--muted`/`--accent`; marca `--primary`; precisão `--precision-indigo`/`--precision-border-*`/`--precision-shadow-*`; estados `--semantic-success|danger|info|new(-surface|-border|-foreground)`; motion `--motion-duration-*`/`--motion-ease-*`.
- **Sem `dark:` manual para cor.** Os tokens semânticos já resolvem light/dark.
- **Um gradiente, dois usos.** Orange→rose→magenta só no logo e em uma palavra de destaque por headline. Nunca em botões ou fundos.
- **Um shape de CTA primário.** `rounded-2xl` + shadow quente `0 12px 28px -8px color-mix(in srgb, var(--primary) 60%, transparent)`. Não inventar variante.
- **Frosted-glass com `color-mix`**, nunca `rgba(255,255,255,0.x)`: `color-mix(in srgb, var(--card) 85%, transparent)`.
- **Ícones só Lucide React.** Sem emoji. Único glifo Unicode permitido: `·` como separador.
- **No App: sem blur, sem orbs** (reservados à superfície marketing).
- **Tipografia:** Poppins no App; Poppins (display) + Inter (corpo) na landing.
- **Copy pt-BR, `você`, sentence case.** CAPS só na palavra de destaque do gradiente.
- **Hero da landing é contrato** e não pode ser alterado (ver `agents.md`).
- **Não editar regiões geridas por `design:sync`** em `app/globals.css`.

## Convenções shadcn / Tailwind (MUST)

- `FieldGroup` + `Field` em formulários — nunca `div` com `space-y-*`.
- `gap-*` em vez de `space-y-*` / `space-x-*`.
- `size-*` quando largura = altura.
- `Skeleton` para loading; `Badge` para status; `Separator` em vez de `<hr>`/`border-t`.
- `sonner` (toast) para feedback; `AlertDialog`/`Dialog` para confirmação — nunca `window.alert/confirm/prompt`.
- `cn()` de `@/lib/utils` para classes condicionais — nunca ternário manual de string.
- Sem `z-index` em overlays (Dialog, Sheet, Drawer, Popover, Tooltip).
- `DialogContent` com conteúdo não-trivial: `max-h-[90vh] flex flex-col`, área interna `overflow-y-auto flex-1`, `DialogFooter` fixo fora do scroll.
- Dialog/Sheet/Drawer sempre com Title (use `sr-only` se oculto). Avatar sempre com `AvatarFallback`.
- Ícone dentro de Button: `data-icon="inline-start"`/`"inline-end"`, sem classe de tamanho.

## Passo final — Validar antes de concluir

Rodar, nesta ordem, após cada edit de UI:

```bash
bun run typecheck 2>&1 | head -20
bun run lint
bun run governance:check
bun run design:check
bun run lint:pt-br
```

Se `design:check` falhar: `bun run design:sync` e commitar o resultado.
Se `lint:pt-br` falhar: corrigir a acentuação do texto de UI sinalizado.

Não reportar a tarefa como concluída se qualquer comando falhar.

## Checklist de conformidade (revisar o diff)

- [ ] Zero hex hardcoded em UI temável — só tokens semânticos.
- [ ] Superfície correta (blur/orbs só em marketing).
- [ ] Componentes priorizam shadcn/ui e `ui_kits/app/` antes de markup custom.
- [ ] Sem `dark:` manual de cor; light/dark coerentes pelos tokens.
- [ ] Tipografia correta para a superfície (Poppins / Poppins+Inter).
- [ ] Ícones Lucide, sem emoji; copy pt-BR sentence case.
- [ ] CTA primário com shape e shadow quente únicos.
- [ ] `design:check`, `lint`, `typecheck`, `governance:check`, `lint:pt-br` passaram.

## Anti-padrões (MUST NOT)

- Hex/cores cruas do Tailwind em UI temável (`bg-blue-500`, `#fff`).
- `space-y-*`/`space-x-*` no lugar de `gap-*`; `w-* h-*` iguais no lugar de `size-*`.
- `animate-pulse` manual em vez de `Skeleton`; `span` estilizado em vez de `Badge`.
- `window.alert/confirm/prompt`; `<hr>`/`border-t` no lugar de `Separator`.
- Blur/orbs dentro do App/CRM; gradiente em botão ou fundo.
- Editar regiões geridas por `design:sync` em `globals.css`.
