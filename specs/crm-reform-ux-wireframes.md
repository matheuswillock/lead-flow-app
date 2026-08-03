# CRM Reform — UX Wireframes & Design Rules

**Versão:** 1.0.0  
**Data:** 2026-08-03  
**Escopo:** Pipeline Table + 4 novas abas do LeadDialog + Página pública de documentos  
**Tokens:** todos os tokens referenciam `DESIGN.md` (sem hex hardcoded)  
**Gerado por:** Agente 0 — UX Spec Writer

---

## Índice

1. [Tela 1 — Pipeline Table: célula Phone + coluna Contatos](#tela-1)
2. [Tela 2 — LeadDialog: aba Tags](#tela-2)
3. [Tela 3 — LeadDialog: aba Contatos](#tela-3)
4. [Tela 4 — LeadDialog: aba Documentos](#tela-4)
5. [Tela 5 — Página pública `/documentos/[token]`](#tela-5)

---

<a id="tela-1"></a>
## Tela 1 — Pipeline Table: célula Phone + nova coluna Contatos

### Wireframe ASCII

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PIPELINE TABLE — linha de dados (thead + tbody row)                                                          │
├──────┬───────────────────┬──────────┬───────────────────────────────┬────────────────────────┬───────────────┤
│  ░░  │  NOME ↕           │  STATUS  │  TELEFONE ↕                   │  CONTATOS              │  TICKET ↕     │
│  ⠿   │                   │          │                               │                        │               │
├──────┼───────────────────┼──────────┼───────────────────────────────┼────────────────────────┼───────────────┤
│      │                   │          │                               │                        │               │
│  ⠿   │ Gabrielle Dias    │ [Agend.] │ (11) 98304-0073  [●WA]       │ [──── 0 contatos ────] │ —             │
│      │                   │          │     ↑                ↑        │          ↑             │               │
│      │                   │          │  clique abre    clique abre   │  badge cinza sutil,    │               │
│      │                   │          │  LeadDialog     wa.me link    │  cursor pointer        │               │
├──────┼───────────────────┼──────────┼───────────────────────────────┼────────────────────────┼───────────────┤
│      │                   │          │                               │                        │               │
│  ⠿   │ Renata Reverendo  │ [Prop.]  │ (11) 95808-0294  [●WA]       │ [●● 3 contatos ──────] │ —             │
│      │                   │          │                               │          ↑             │               │
│      │                   │          │                               │  badge cor destaque,   │               │
│      │                   │          │                               │  hover: tooltip        │               │
│      │                   │          │                               │  "Ver contatos"        │               │
└──────┴───────────────────┴──────────┴───────────────────────────────┴────────────────────────┴───────────────┘

DETALHE — célula TELEFONE (após reforma):
┌──────────────────────────────────────────────────────┐
│  Célula td[phone] — layout interno                   │
│                                                      │
│  ┌──────────────────────────────┬──────────────────┐ │
│  │ span.text-sm                 │  Button variant= │ │
│  │ text-muted-foreground        │  ghost size=icon │ │
│  │ "(11) 98304-0073"            │  [  ●WA  ]       │ │  ← ícone PhoneCall + MessageCircle verde
│  │ cursor: pointer              │  text-[#25D366]  │ │
│  │ onClick → openLeadDialog()   │  onClick → nova  │ │
│  │                              │  aba (target=_blank) │
│  └──────────────────────────────┴──────────────────┘ │
│                                                      │
│  Estado hover do número:                             │
│  • underline text-foreground                         │
│  Estado hover do botão WA:                           │
│  • bg-[color-mix(in_srgb,#25D366_12%,transparent)]   │  ← usando token via cn() dinâmico
│  • scale-110 transition                              │
└──────────────────────────────────────────────────────┘

DETALHE — célula CONTATOS (nova coluna):
┌──────────────────────────────────────────────────────┐
│  Estado 0 contatos:                                  │
│  ┌───────────────────────────────┐                   │
│  │  [  0  ]   ← Badge variant=  │                   │
│  │  secondary, text-muted-fore- │                   │
│  │  ground, rounded-md          │                   │
│  └───────────────────────────────┘                   │
│                                                      │
│  Estado N > 0 contatos:                              │
│  ┌───────────────────────────────┐                   │
│  │  [●● 3 ]   ← Badge variant=  │                   │
│  │  outline, border-blue-400/40 │                   │
│  │  text-blue-300 (semântico:   │                   │
│  │  text-[hsl(var(--blue-fg))]) │                   │
│  │  bg-blue-500/10              │                   │
│  └───────────────────────────────┘                   │
│                                                      │
│  Hover em qualquer estado:                           │
│  • Tooltip "Ver contatos" (TooltipProvider)          │
│  • scale-105 transition-transform                    │
│  Clique:                                             │
│  • openLeadDialog(lead, { initialTab: 'contatos' })  │
└──────────────────────────────────────────────────────┘

POSIÇÃO DA NOVA COLUNA:
... | TELEFONE | CONTATOS | PLANO ATUAL | VALOR | STATUS | TICKET | ...
                 ↑
     inserida após "Telefone", antes "Plano atual"
```

### Regras de UX

1. **Clique no número de telefone** → `stopPropagation()` + `openLeadDialog(lead)` com aba padrão (Dados). NÃO abre WhatsApp.
2. **Clique no ícone WhatsApp** → `stopPropagation()` + `window.open('https://wa.me/55' + ddd + number, '_blank', 'noopener')`. NÃO abre LeadDialog. O número deve ter DDD e dígitos concatenados sem formatação (apenas dígitos).
3. **Clique no badge Contatos** → `stopPropagation()` + `openLeadDialog(lead, { initialTab: 'contatos' })`.
4. **Estado default do ícone WA** → visível sempre (não escondido até hover), cor `text-[#25D366]` via classe utilitária customizada ou inline style. Tamanho 14px.
5. **Estado hover da linha** → comportamento atual preservado (`bg-primary/4`). Os botões internos recebem seus próprios hovers sem sobrescrever o da linha.
6. **Estado loading** → enquanto `openLeadDialog` carrega, a linha permanece interagível; nenhum spinner na célula.
7. **Estado empty (phone = null)** → célula exibe `—` sem ícone WA.
8. **Estado empty (contactCount = 0)** → Badge `secondary` cinza. Tooltip mantido ("Ver contatos").
9. **Keyboard** → `Tab` entre células. `Enter` ou `Space` em qualquer célula da linha abre LeadDialog (exceto ícone WA que deve ter `role="link"` e `aria-label="Abrir conversa no WhatsApp"`).
10. **Ordenação da nova coluna Contatos** → suporta sort por `contactCount` (campo numérico). Header exibe setas `↑ ↓ ↕` via `column.toggleSorting`.
11. **Coluna ocultável** → `meta: { label: 'Contatos' }` + `enableHiding: true` (padrão das demais colunas).
12. **Feedback de clique no WA** → nenhum toast; a nova aba do browser é o próprio feedback. Se o número for inválido/nulo, o botão não renderiza.

### Componentes shadcn

| Elemento visual | Componente shadcn | Import path |
|---|---|---|
| Badge "0 contatos" (cinza) | `Badge` variant `secondary` | `@/components/ui/badge` |
| Badge "N contatos" (azul) | `Badge` variant `outline` + className | `@/components/ui/badge` |
| Tooltip "Ver contatos" | `Tooltip / TooltipTrigger / TooltipContent / TooltipProvider` | `@/components/ui/tooltip` |
| Botão ícone WhatsApp | `Button` variant `ghost` size `icon` | `@/components/ui/button` |
| Linha da tabela | `TableRow / TableCell` | `@/components/ui/table` |

---

<a id="tela-2"></a>
## Tela 2 — LeadDialog: aba Tags

### Wireframe ASCII

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ LEAD DIALOG — painel esquerdo (left panel, width ~860px total, left ~544px)                              │
│                                                                                                         │
│ ┌─ left-head ──────────────────────────────────────────────────────────────────────────────────────┐    │
│ │  Guilherme Marques                                                       [  Fechar  ×  ]         │    │
│ │  vejaplanos@gmail.com · (11) 99345-1703                                                          │    │
│ └──────────────────────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                                         │
│ ┌─ tabs ───────────────────────────────────────────────────────────────────────────────────────────┐    │
│ │  [ Dados ]  [ Beneficiários ]  [ Anexos ]  [ Tags ●──────active ]  [ Contatos 3 ]  [ Docs ]     │    │
│ │                                                ↑                                                 │    │
│ │                                         underline cor --purple                                   │    │
│ └──────────────────────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                                         │
│ ┌─ left-body (overflow-y: auto) ───────────────────────────────────────────────────────────────────┐    │
│ │                                                                                                   │    │
│ │  SEÇÃO: Tags aplicadas                                                                            │    │
│ │  ─────────────────────────────────────────────────────────────────────                           │    │
│ │                                                                                                   │    │
│ │  [Estado COM tags]                                                                                │    │
│ │  ┌───────────────────────────────────────────────────────────────────────────────────────────┐   │    │
│ │  │  ┌──────────────────────────┐  ┌──────────────────────────┐  ┌──────────────────────┐    │   │    │
│ │  │  │ ● Organização: CRM   ×  │  │ ● Aguardando retorno  ×  │  │ ● Sem resposta   ×   │    │   │    │
│ │  │  │   bg=color-mix(tag,18%) │  │   bg=color-mix(tag,18%)  │  │  bg=color-mix(…,18%) │    │   │    │
│ │  │  │   border=color-mix(40%) │  │   border=color-mix(40%)  │  │  border=color-mix(…) │    │   │    │
│ │  │  │   text=cor-da-tag       │  │   text=cor-da-tag        │  │  text=cor-da-tag      │    │   │    │
│ │  │  └──────────────────────────┘  └──────────────────────────┘  └──────────────────────┘    │   │    │
│ │  │         ↑ chip wrap, gap-2, padding-y 2px padding-x 8px, rounded-md                      │   │    │
│ │  │         ↑ ícone × tem tamanho 10px, clique remove tag                                     │   │    │
│ │  └───────────────────────────────────────────────────────────────────────────────────────────┘   │    │
│ │                                                                                                   │    │
│ │  [Estado SEM tags — empty state]                                                                  │    │
│ │  ┌───────────────────────────────────────────────────────────────────────────────────────────┐   │    │
│ │  │                                                                                           │   │    │
│ │  │   ┌──────────────────────────────────────────────────────────────────┐                   │   │    │
│ │  │   │   🏷  Nenhuma tag aplicada                                       │                   │   │    │
│ │  │   │       Adicione tags para categorizar este lead.                  │                   │   │    │
│ │  │   └──────────────────────────────────────────────────────────────────┘                   │   │    │
│ │  │          ↑ border border-dashed rounded-lg p-4 text-center                               │   │    │
│ │  │          ↑ texto text-muted-foreground text-sm                                           │   │    │
│ │  └───────────────────────────────────────────────────────────────────────────────────────────┘   │    │
│ │                                                                                                   │    │
│ │  SEÇÃO: Sugestões de tags do time (não aplicadas)                                                 │    │
│ │  ─────────────────────────────────────────────────────────────────────────────                    │    │
│ │                                                                                                   │    │
│ │  ┌───────────────────────────────────────────────────────────────────────────────────────────┐   │    │
│ │  │  ┌─────────────────────────┐  ┌──────────────────────────┐  ┌──────────────────────┐     │   │    │
│ │  │  │ ● Encaminhado corretor  │  │ ● Organização: Planilha  │  │ ● Nutrição            │     │   │    │
│ │  │  │   variant=outline       │  │   variant=outline        │  │  variant=outline      │     │   │    │
│ │  │  │   cursor=pointer        │  │                          │  │                       │     │   │    │
│ │  │  └─────────────────────────┘  └──────────────────────────┘  └──────────────────────┘     │   │    │
│ │  │         ↑ chips clicáveis, hover: bg-accent, clique: aplica tag ao lead                  │   │    │
│ │  │         ↑ sem × (sugestão não tem remoção)                                               │   │    │
│ │  └───────────────────────────────────────────────────────────────────────────────────────────┘   │    │
│ │                                                                                                   │    │
│ │  [Estado vazio — sem sugestões]                                                                   │    │
│ │  ┌───────────────────────────────────────────────────────────────────────────────────────────┐   │    │
│ │  │   text-muted-foreground text-xs italic — "Todas as tags do time já estão aplicadas"       │   │    │
│ │  └───────────────────────────────────────────────────────────────────────────────────────────┘   │    │
│ │                                                                                                   │    │
│ │  SEÇÃO: Nova tag                                                                                  │    │
│ │  ─────────────────────────────────────────────────────────────────────────                        │    │
│ │                                                                                                   │    │
│ │  ┌─ FieldGroup ──────────────────────────────────────────────────────────────────────────────┐   │    │
│ │  │                                                                                           │   │    │
│ │  │  ┌─ Field label="Nome da tag" ──────────────────────────────────────────────────────┐    │   │    │
│ │  │  │  ┌────────────────────────────────────────────────────────────────────────────┐  │    │   │    │
│ │  │  │  │  Input placeholder="Ex: Aguardando documentos"                             │  │    │   │    │
│ │  │  │  └────────────────────────────────────────────────────────────────────────────┘  │    │   │    │
│ │  │  └──────────────────────────────────────────────────────────────────────────────────┘    │   │    │
│ │  │                                                                                           │   │    │
│ │  │  ┌─ Field label="Cor" ──────────────────────────────────────────────────────────────┐    │   │    │
│ │  │  │                                                                                   │    │   │    │
│ │  │  │  ┌───────────────────────────────────────────────────────────────────────────┐   │    │   │    │
│ │  │  │  │  [██] [██] [██] [██] [██] [██] [██] [██]                                 │   │    │   │    │
│ │  │  │  │  ↑ 8 swatches de cor pré-definida                                        │   │    │   │    │
│ │  │  │  │  Cada swatch: size-6 rounded-full cursor-pointer                         │   │    │   │    │
│ │  │  │  │  Swatch selecionado: ring-2 ring-offset-2 ring-[cor] scale-110            │   │    │   │    │
│ │  │  │  │  Cores sugeridas (token-safe via CSS var ou inline):                      │   │    │   │    │
│ │  │  │  │  #10B981 #F59E0B #25D366 #06B6D4 #3B82F6 #8B5CF6 #EF4444 #6B7280        │   │    │   │    │
│ │  │  │  └───────────────────────────────────────────────────────────────────────────┘   │    │   │    │
│ │  │  └──────────────────────────────────────────────────────────────────────────────────┘    │   │    │
│ │  │                                                                                           │   │    │
│ │  │  Preview do chip (renderizado em tempo real enquanto digita):                             │   │    │
│ │  │  ┌────────────────────────────────────────────────────┐                                  │   │    │
│ │  │  │  Prévia:  [ ● Aguardando documentos    ]           │                                  │   │    │
│ │  │  │            ↑ cor dinâmica do swatch selecionado     │                                  │   │    │
│ │  │  └────────────────────────────────────────────────────┘                                  │   │    │
│ │  │                                                                                           │   │    │
│ │  │  ┌────────────────────────────────────────────────────────────────────────────────────┐  │   │    │
│ │  │  │                                         [ Adicionar tag ]  ← Button variant=default│  │   │    │
│ │  │  │                                            disabled se input vazio                  │  │   │    │
│ │  │  └────────────────────────────────────────────────────────────────────────────────────┘  │   │    │
│ │  └───────────────────────────────────────────────────────────────────────────────────────────┘   │    │
│ │                                                                                                   │    │
│ └───────────────────────────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Regras de UX

1. **Aba Tags** → `tab.on::after` usa `background: hsl(var(--color-purple))` (token `--purple` mapeado no DESIGN). `tab.on` usa `color: hsl(var(--color-purple))`. Tab count badge usa `bg-purple-500/15 text-purple-400`.
2. **Aplicar tag sugerida** → clique no chip de sugestão chama `PATCH /leads/:id/tags`, mostra loading (opacity-50 pointer-events-none), ao sucesso: chip migra de "Sugestões" para "Tags aplicadas" com animação `fade-in` e toast success via `sonner`.
3. **Remover tag aplicada** → clique em × chama `DELETE /leads/:id/tags/:tagId`, mostra loading no chip específico, ao sucesso remove o chip com animação `fade-out`. Alert via sonner em caso de erro.
4. **Criar nova tag** → botão "Adicionar" disabled até: input não vazio E cor selecionada. Ao clicar: loading state no botão (`disabled + spinner`). Ao sucesso: tag criada e imediatamente aplicada ao lead; input e seleção de cor resetados; sonner success.
5. **Cor da tag** → armazenada como hex string. Renderização dos chips usa `color-mix(in srgb, <hex-da-tag> 18%, transparent)` para `background`, `color-mix(in srgb, <hex-da-tag> 40%, transparent)` para `border`, hex puro para `color`. Nunca use tokens semânticos hardcoded para cor de tag — é sempre dinâmico.
6. **Preview em tempo real** → à medida que o usuário digita o nome e seleciona a cor, o chip preview atualiza instantaneamente (estado React local, sem debounce).
7. **Empty state "Tags aplicadas"** → exibe ícone Tag + texto descritivo. Não exibe spinner.
8. **Empty state "Sugestões"** → exibe texto em itálico discreto. Não exibe componente vazio.
9. **Keyboard** → `Tab` entre campos do formulário. `Enter` submete o formulário nova tag (se válido). `Esc` limpa o input e deseleciona cor.
10. **Acessibilidade** → cada swatch de cor tem `aria-label="Selecionar cor <nome>"` e `role="radio"`. Grupo de swatches tem `role="radiogroup"` e `aria-label="Cor da tag"`.
11. **Ordenação dos chips aplicados** → ordem de aplicação (mais recente por último). Não alfabética.
12. **Limite de tags** → sem limite de UI (validação backend). Se o servidor retornar erro de limite, toast error.
13. **Tag duplicada** → se o usuário tentar criar tag com nome idêntico a outra do time, servidor retorna 409. Toast error: "Já existe uma tag com esse nome".

### Componentes shadcn

| Elemento visual | Componente shadcn | Import path |
|---|---|---|
| Chip de tag aplicada | `Badge` variant `outline` + inline style dinâmico | `@/components/ui/badge` |
| Chip de sugestão | `Badge` variant `outline` | `@/components/ui/badge` |
| Empty state border-dashed | Markup custom com tokens (sem componente shadcn específico) | — |
| Input nome da tag | `Input` | `@/components/ui/input` |
| Swatches de cor | `Button` variant `ghost` size `icon` (cada swatch) | `@/components/ui/button` |
| Botão "Adicionar tag" | `Button` variant `default` | `@/components/ui/button` |
| Separador entre seções | `Separator` | `@/components/ui/separator` |
| Toast feedback | `sonner` (toast function) | `@/components/ui/sonner` |
| Container de formulário | `FieldGroup` + `Field` | `@/components/ui/field` |
| Skeleton loading tag | `Skeleton` | `@/components/ui/skeleton` |

---

<a id="tela-3"></a>
## Tela 3 — LeadDialog: aba Contatos

### Wireframe ASCII

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ LEAD DIALOG — aba Contatos (left panel)                                                              │
│                                                                                                      │
│ [ Dados ] [ Beneficiários ] [ Anexos ] [ Tags ] [ Contatos ●── active ] [ Docs ]                    │
│                                                     ↑ underline cor --blue                          │
│ ─────────────────────────────────────────────────────────────────────────────────────────────────   │
│                                                                                                      │
│  ┌─ STAT CARDS (grid 3 colunas, gap-3) ──────────────────────────────────────────────────────────┐  │
│  │                                                                                                │  │
│  │  ┌─────────────────────┐  ┌─────────────────────┐  ┌────────────────────────┐                 │  │
│  │  │ TOTAL DE CONTATOS   │  │ ÚLTIMO CONTATO      │  │ EFETIVIDADE            │                 │  │
│  │  │                     │  │                     │  │                        │                 │  │
│  │  │      7              │  │   há 2 dias         │  │       71%              │                 │  │
│  │  │                     │  │   17 jun 2026        │  │ 5 de 7 positivos      │                 │  │
│  │  │ text-foreground     │  │ text-foreground     │  │ text-foreground        │                 │  │
│  │  │ font-display        │  │ text-muted-fg sub   │  │ text-muted-fg sub      │                 │  │
│  │  └─────────────────────┘  └─────────────────────┘  └────────────────────────┘                 │  │
│  │   ↑ bg-card border rounded-xl p-3                                                              │  │
│  └────────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                      │
│  ┌─ BARRA DE AÇÕES (gap-2, justify-start) ────────────────────────────────────────────────────────┐  │
│  │                                                                                                │  │
│  │  [ + Registrar contato ]        [ 🔔 Agendar alerta  ]                                        │  │
│  │   ↑ Button primary               ↑ Button secondary, disabled=true                            │  │
│  │   onClick → abre formulário        tooltip "Em breve" quando hover                            │  │
│  │                                                                                                │  │
│  └────────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                      │
│  ══════════════════════════════════════════════════════════════════════════════════════════════════   │
│  ESTADO A — formulário FECHADO (apenas timeline)                                                     │
│  ══════════════════════════════════════════════════════════════════════════════════════════════════   │
│                                                                                                      │
│  ┌─ TIMELINE (agrupada por data, mais recente primeiro) ──────────────────────────────────────────┐  │
│  │                                                                                                │  │
│  │  ─────────────── HOJE ────────────────────────────────────                                     │  │
│  │                                                                                                │  │
│  │  ┌─ contact-card ─────────────────────────────────────────────────────────────────────────┐   │  │
│  │  │                                                                                        │   │  │
│  │  │  ┌────────────┐  Ligação                  [● Atendeu — Interessado]                   │   │  │
│  │  │  │  [📞]      │  17 jun 2026 · 09:14 · por Nathiele Willock · ⏱ 4min 32s             │   │  │
│  │  │  │  bg-green  │                                                                        │   │  │
│  │  │  └────────────┘  ───────────────────────────────────────────────────────────────────   │   │  │
│  │  │  ↑ cc-icon size-9 rounded-lg                                                           │   │  │
│  │  │                                                                                        │   │  │
│  │  │  "Cliente interessada. Pediu cotação para 2 vidas."                                    │   │  │
│  │  │  ↑ notas colapsáveis via Collapsible (ver abaixo), inicialmente expandido              │   │  │
│  │  │                                                                                        │   │  │
│  │  │  ┌──────────────────────────────────────────────────────────────────────────────────┐ │   │  │
│  │  │  │  [ Avatar NW ]  Nathiele Willock — Closer                                        │ │   │  │
│  │  │  └──────────────────────────────────────────────────────────────────────────────────┘ │   │  │
│  │  └────────────────────────────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                                                │  │
│  │  ─────────────── ONTEM ──────────────────────────────                                          │  │
│  │                                                                                                │  │
│  │  ┌─ contact-card ─────────────────────────────────────────────────────────────────────────┐   │  │
│  │  │  ┌────────────┐  WhatsApp                  [● Visualizou — Não respondeu]              │   │  │
│  │  │  │  [💬 WA]   │  16 jun 2026 · 14:00 · por Nathiele Willock                           │   │  │
│  │  │  └────────────┘  ─────────────────────────────────────────────────────────────────    │   │  │
│  │  │  "Enviou tabela de preços pelo WhatsApp."                                              │   │  │
│  │  │  ↑ Collapsible — clique no card expande/colapsa notas                                  │   │  │
│  │  └────────────────────────────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                                                │  │
│  │  ─────────────── 14 AGO 2026 ───────────────────────                                           │  │
│  │  ...                                                                                           │  │
│  │                                                                                                │  │
│  └────────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                      │
│  ══════════════════════════════════════════════════════════════════════════════════════════════════   │
│  ESTADO B — formulário ABERTO (acima da timeline)                                                    │
│  ══════════════════════════════════════════════════════════════════════════════════════════════════   │
│                                                                                                      │
│  ┌─ FORMULÁRIO INLINE (animação slideDown 180ms ease-out) ────────────────────────────────────────┐  │
│  │  bg-card border rounded-xl p-4 mb-4                                                           │  │
│  │                                                                                                │  │
│  │  ┌─ FieldGroup ───────────────────────────────────────────────────────────────────────────┐   │  │
│  │  │                                                                                        │   │  │
│  │  │  ┌─ grid grid-cols-2 gap-3 ──────────────────────────────────────────────────────┐    │   │  │
│  │  │  │                                                                               │    │   │  │
│  │  │  │  ┌─ Field label="Tipo de contato" ──────────────────────────────┐             │    │   │  │
│  │  │  │  │  Select                                                      │             │    │   │  │
│  │  │  │  │  ├── Ligação (call)                                          │             │    │   │  │
│  │  │  │  │  ├── WhatsApp (whatsapp)                                     │             │    │   │  │
│  │  │  │  │  ├── E-mail (email)                                          │             │    │   │  │
│  │  │  │  │  ├── Reunião (meeting)                                       │             │    │   │  │
│  │  │  │  │  ├── Visita (visit)                                          │             │    │   │  │
│  │  │  │  │  └── Não atendeu (missed)                                    │             │    │   │  │
│  │  │  │  └──────────────────────────────────────────────────────────────┘             │    │   │  │
│  │  │  │                                                                               │    │   │  │
│  │  │  │  ┌─ Field label="Outcome" ──────────────────────────────────────┐             │    │   │  │
│  │  │  │  │  Select (opções mudam conforme tipo selecionado)             │             │    │   │  │
│  │  │  │  │  [call]    Atendeu-Interessado / Atendeu-Callback /          │             │    │   │  │
│  │  │  │  │            Atendeu-Sem interesse / Não atendeu / Caixa postal│             │    │   │  │
│  │  │  │  │  [whatsapp] Respondeu-Interessado / Respondeu-Callback /     │             │    │   │  │
│  │  │  │  │            Respondeu-Sem int. / Visualizou-N.resp. /         │             │    │   │  │
│  │  │  │  │            Não visualizou / Não respondeu                    │             │    │   │  │
│  │  │  │  │  [email]   Abriu-Respondeu / Abriu-S.resp. / Não abriu      │             │    │   │  │
│  │  │  │  │  [meeting] Realizada-Int. / Realizada-Fechou / Reagendada /  │             │    │   │  │
│  │  │  │  │            Não compareceu                                    │             │    │   │  │
│  │  │  │  │  [visit]   Realizada-Int. / Realizada-Fechou / Reagendada /  │             │    │   │  │
│  │  │  │  │            Não estava                                        │             │    │   │  │
│  │  │  │  │  [missed]  Não atendeu / Caixa postal                       │             │    │   │  │
│  │  │  │  └──────────────────────────────────────────────────────────────┘             │    │   │  │
│  │  │  └───────────────────────────────────────────────────────────────────────────────┘    │   │  │
│  │  │                                                                                        │   │  │
│  │  │  ┌─ grid grid-cols-2 gap-3 ──────────────────────────────────────────────────────┐    │   │  │
│  │  │  │                                                                               │    │   │  │
│  │  │  │  ┌─ Field label="Data" ─────────────────────────────────────────┐             │    │   │  │
│  │  │  │  │  Input type="date" (DatePicker)                              │             │    │   │  │
│  │  │  │  │  default: hoje (new Date().toISOString().split('T')[0])      │             │    │   │  │
│  │  │  │  └──────────────────────────────────────────────────────────────┘             │    │   │  │
│  │  │  │                                                                               │    │   │  │
│  │  │  │  ┌─ Field label="Horário" ──────────────────────────────────────┐             │    │   │  │
│  │  │  │  │  Input type="time"                                           │             │    │   │  │
│  │  │  │  │  default: hora atual formatada HH:mm                        │             │    │   │  │
│  │  │  │  └──────────────────────────────────────────────────────────────┘             │    │   │  │
│  │  │  └───────────────────────────────────────────────────────────────────────────────┘    │   │  │
│  │  │                                                                                        │   │  │
│  │  │  ┌─ Field label="Duração (min)" — aparece apenas para call, meeting, visit ───────┐   │   │  │
│  │  │  │  Input type="number" min="0" max="999" placeholder="ex: 5"                    │   │   │  │
│  │  │  │  ↑ conditionally rendered; animação fade-in quando aparece                    │   │   │  │
│  │  │  └──────────────────────────────────────────────────────────────────────────────────┘  │   │  │
│  │  │                                                                                        │   │  │
│  │  │  ┌─ Field label="Notas" ──────────────────────────────────────────────────────────┐   │   │  │
│  │  │  │  Textarea rows=3 placeholder="O que aconteceu nesse contato?"                 │   │   │  │
│  │  │  └──────────────────────────────────────────────────────────────────────────────────┘  │   │  │
│  │  │                                                                                        │   │  │
│  │  │  ┌─ footer flex justify-end gap-2 ───────────────────────────────────────────────┐    │   │  │
│  │  │  │  [ Cancelar ]   [ Salvar contato ]                                            │    │   │  │
│  │  │  │  ↑ ghost          ↑ default, disabled se tipo/outcome não selecionados        │    │   │  │
│  │  │  │                   loading spinner ao submeter                                  │    │   │  │
│  │  │  └───────────────────────────────────────────────────────────────────────────────┘    │   │  │
│  │  │                                                                                        │   │  │
│  │  └────────────────────────────────────────────────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                      │
│  ↓ TIMELINE (igual ao estado A, exibida abaixo do formulário)                                        │
│                                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘

DETALHE — Cores dos ícones de tipo de contato:
  call / whatsapp  → icon bg: color-mix(in srgb, hsl(var(--chart-2)) 15%, transparent)   ← verde semântico
  email            → icon bg: color-mix(in srgb, hsl(var(--chart-1)) 15%, transparent)   ← azul semântico
  meeting          → icon bg: color-mix(in srgb, hsl(var(--chart-4)) 15%, transparent)   ← roxo semântico
  visit            → icon bg: color-mix(in srgb, hsl(var(--primary)) 15%, transparent)   ← orange primário
  missed           → icon bg: color-mix(in srgb, hsl(var(--destructive)) 12%, transparent)

DETALHE — Outcome badge colors:
  positivo (interested/fechou/realizada) → bg-green-500/12 border-green-500/30 text-green-600
  neutro  (callback/viu/voicemail)       → bg-amber-500/12 border-amber-500/30 text-amber-600
  negativo (sem interesse/não compareceu)→ bg-destructive/12 border-destructive/30 text-destructive
  sem outcome (missed)                   → bg-muted border text-muted-foreground
  ↑ todos usando tokens semânticos, nunca hex hardcoded
```

### Regras de UX

1. **Abrir formulário** → clique em "Registrar contato" insere o painel formulário acima da timeline com animação `slideDown 180ms ease-out`. O botão "Registrar contato" muda para disabled enquanto formulário aberto (evita dupla abertura).
2. **Fechar formulário** → clique em "Cancelar" ou após salvar com sucesso. Animação `slideUp 140ms ease-in`. Pergunta de confirmação de descarte apenas se campos foram preenchidos.
3. **Tipo muda outcome** → ao alterar o Select de tipo, o Select de outcome é resetado para o primeiro item correspondente da lista `OUTCOMES_BY_TYPE[tipo]`. Transição suave de opções (React key no SelectContent força remount).
4. **Campo Duração** → visível somente quando tipo = `call | meeting | visit`. Usa `display: none` (mantido no DOM) para não perder o valor ao re-selecionar o tipo.
5. **Salvar contato** → botão locked enquanto pending. Ao sucesso: formulário fecha, novo card aparece no topo da timeline do dia correto com animação `fadeUp`, stat cards atualizam, toast "Contato registrado" via sonner.
6. **Timeline agrupamento** → chave de grupo é a data local no timezone do time (`useTimezone`). Grupos: "Hoje", "Ontem", datas formatadas como "3 ago 2026". Ordem: mais recente no topo.
7. **Notas colapsáveis** → cada contact-card usa `Collapsible`. Estado default: expandido se notas < 120 chars, colapsado se >= 120 chars. Clique no botão ChevronDown/Up alterna.
8. **Avatar do registrador** → `Avatar` com `AvatarFallback` de iniciais. Tooltip com nome completo + função (Closer / SDR).
9. **Botão "Agendar alerta"** → `disabled` + `cursor-not-allowed`. `TooltipProvider` ao redor: hover exibe "Em breve — Fase 2".
10. **Stat "Efetividade"** → porcentagem = contatos com outcome em `answered_interested | answered_callback` / total de contatos × 100. Arredondado para inteiro. Se 0 contatos → exibe `—`.
11. **Stat "Último contato"** → data relativa usando `formatDistance` (`date-fns/pt-BR`). Sub-texto com data absoluta.
12. **Empty state da timeline** → quando sem contatos, exibe área dashed centralizada: ícone PhoneOff + "Nenhum contato registrado ainda. Registre o primeiro contato acima."
13. **Keyboard** → `Tab` entre campos do formulário. `Ctrl+Enter` submete. `Esc` cancela (com confirmação de descarte se sujo).
14. **Loading initial** → ao abrir a aba Contatos, stat cards mostram `Skeleton` (3 retângulos) enquanto dados carregam.

### Componentes shadcn

| Elemento visual | Componente shadcn | Import path |
|---|---|---|
| Stat cards | `Card / CardContent` | `@/components/ui/card` |
| Botão "Registrar contato" | `Button` variant `default` | `@/components/ui/button` |
| Botão "Agendar alerta" (disabled) | `Button` variant `outline` disabled | `@/components/ui/button` |
| Tooltip "Em breve" | `Tooltip / TooltipProvider` | `@/components/ui/tooltip` |
| Select tipo/outcome | `Select / SelectTrigger / SelectContent / SelectItem` | `@/components/ui/select` |
| Input data | `Input` type="date" | `@/components/ui/input` |
| Input horário | `Input` type="time" | `@/components/ui/input` |
| Input duração | `Input` type="number" | `@/components/ui/input` |
| Textarea notas | `Textarea` | `@/components/ui/textarea` |
| Container formulário | `FieldGroup` + `Field` | `@/components/ui/field` |
| Separador de grupo de data | `Separator` (custom com label) | `@/components/ui/separator` |
| Notas colapsáveis | `Collapsible / CollapsibleTrigger / CollapsibleContent` | `@/components/ui/collapsible` |
| Avatar do registrador | `Avatar / AvatarFallback / AvatarImage` | `@/components/ui/avatar` |
| Outcome badge | `Badge` variant `outline` + className dinâmico | `@/components/ui/badge` |
| Skeleton inicial | `Skeleton` | `@/components/ui/skeleton` |
| Toast feedback | `sonner` | `@/components/ui/sonner` |

---

<a id="tela-4"></a>
## Tela 4 — LeadDialog: aba Documentos

### Wireframe ASCII

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ LEAD DIALOG — aba Documentos (left panel)                                                            │
│                                                                                                      │
│ [ Dados ] [ Beneficiários ] [ Anexos ] [ Tags ] [ Contatos 3 ] [ Documentos ●── active ]            │
│                                                                       ↑ underline --primary          │
│ ──────────────────────────────────────────────────────────────────────────────────────────────────   │
│                                                                                                      │
│  ┌─ HEADER DA ABA (flex justify-between items-center mb-4) ──────────────────────────────────────┐  │
│  │                                                                                               │  │
│  │  Solicitações de documentos                    [ + Gerar nova solicitação ]                  │  │
│  │  text-sm text-muted-foreground                  ↑ Button variant=default size=sm             │  │
│  │  (N solicitações)                                                                             │  │
│  └───────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                      │
│  ══════════════════════════════════════════════════════════════════════════════════════════════════   │
│  ESTADO A — LISTA DE SOLICITAÇÕES                                                                    │
│  ══════════════════════════════════════════════════════════════════════════════════════════════════   │
│                                                                                                      │
│  ┌─ card solicitação #1 ──────────────────────────────────────────────────────────────────────────┐  │
│  │  bg-card border rounded-xl overflow-hidden                                                    │  │
│  │                                                                                               │  │
│  │  ┌─ CARD HEADER (flex justify-between p-4 border-b) ──────────────────────────────────────┐  │  │
│  │  │  Solicitação #1 · 29 jul 2026 às 14:23        [ Pendente ]  ← Badge variant=outline    │  │  │
│  │  │  text-sm font-semibold                          badge amber                             │  │  │
│  │  └──────────────────────────────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                                               │  │
│  │  ┌─ LISTA DE DOCUMENTOS (p-4 flex flex-col gap-2) ────────────────────────────────────────┐  │  │
│  │  │  ┌────────────────────────────────────────────────────────────────────────────────┐    │  │  │
│  │  │  │  ⏳  RG ou CNH (frente e verso)                                               │    │  │  │
│  │  │  │  ↑ Clock icon text-amber-500                                                  │    │  │  │
│  │  │  └────────────────────────────────────────────────────────────────────────────────┘    │  │  │
│  │  │  ┌────────────────────────────────────────────────────────────────────────────────┐    │  │  │
│  │  │  │  ⏳  Comprovante de residência (últimos 3 meses)                               │    │  │  │
│  │  │  └────────────────────────────────────────────────────────────────────────────────┘    │  │  │
│  │  │  ┌────────────────────────────────────────────────────────────────────────────────┐    │  │  │
│  │  │  │  ✅  Carteirinha do plano atual                                                │    │  │  │
│  │  │  │  ↑ CheckCircle icon text-green-500 (enviado)                                   │    │  │  │
│  │  │  └────────────────────────────────────────────────────────────────────────────────┘    │  │  │
│  │  └──────────────────────────────────────────────────────────────────────────────────────┘  │  │  │
│  │                                                                                               │  │
│  │  ┌─ CARD FOOTER (p-3 pt-0 flex items-center gap-2 flex-wrap) ─────────────────────────────┐  │  │
│  │  │                                                                                        │  │  │
│  │  │  🔗 https://app.corretorstudio.com/doc...  [📋]  [ Reenviar e-mail ]                  │  │  │
│  │  │  ↑ text-xs text-muted-foreground           ↑       ↑ Button variant=ghost size=sm      │  │  │
│  │  │    truncado max-w-[260px] overflow-hidden   Button  ↑ com ícone Mail                   │  │  │
│  │  │    text-ellipsis whitespace-nowrap          icon    click → POST /resend-email          │  │  │
│  │  │                                             copy    + sonner toast "E-mail reenviado"  │  │  │
│  │  └──────────────────────────────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                      │
│  ┌─ card solicitação #2 ──────────────────────────────────────────────────────────────────────────┐  │
│  │  ┌─ CARD HEADER ────────────────────────────────────────────────────────────────────────────┐ │  │
│  │  │  Solicitação #2 · 25 jul 2026 às 10:00               [ Completo ] ← Badge verde         │ │  │
│  │  └──────────────────────────────────────────────────────────────────────────────────────────┘ │  │
│  │  ... (lista de docs — todos com ✅)                                                           │  │
│  │  ┌─ CARD FOOTER ────────────────────────────────────────────────────────────────────────────┐ │  │
│  │  │  🔗 https://app.corretorstudio.com/doc... [📋] [ Reenviar e-mail ]                       │ │  │
│  │  └──────────────────────────────────────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                      │
│  ══════════════════════════════════════════════════════════════════════════════════════════════════   │
│  ESTADO B — EMPTY (zero solicitações)                                                                │
│  ══════════════════════════════════════════════════════════════════════════════════════════════════   │
│                                                                                                      │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                                                                                               │  │
│  │   ┌─────────────────────────────────────────────────────────────────────────────────────┐   │  │
│  │   │                                                                                     │   │  │
│  │   │   📄  Nenhuma solicitação de documentos                                             │   │  │
│  │   │       Gere uma solicitação para pedir documentos ao lead                            │   │  │
│  │   │       de forma organizada.                                                          │   │  │
│  │   │                                                                                     │   │  │
│  │   │                    [ + Gerar primeira solicitação ]                                 │   │  │
│  │   │                     ↑ Button variant=default                                        │   │  │
│  │   │                                                                                     │   │  │
│  │   └─────────────────────────────────────────────────────────────────────────────────────┘   │  │
│  │   ↑ border border-dashed rounded-xl p-8 text-center text-muted-foreground                   │  │
│  └───────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                      │
│  ══════════════════════════════════════════════════════════════════════════════════════════════════   │
│  ESTADO C — SHEET DE CRIAÇÃO (abre ao clicar "Gerar nova solicitação")                               │
│  ══════════════════════════════════════════════════════════════════════════════════════════════════   │
│                                                                                                      │
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SHEET (side=right, width=480px)                                                                       │
│                                                                                                       │
│ ┌─ SheetHeader ─────────────────────────────────────────────────────────────────────────────────────┐ │
│ │  SheetTitle (visível): Gerar solicitação de documentos                                            │ │
│ │  SheetDescription: Informe os documentos necessários e uma mensagem para o lead.                  │ │
│ └───────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                                       │
│ ┌─ SheetBody (overflow-y-auto flex-1 p-6) ──────────────────────────────────────────────────────────┐ │
│ │                                                                                                   │ │
│ │  ┌─ FieldGroup ────────────────────────────────────────────────────────────────────────────────┐  │ │
│ │  │                                                                                             │  │ │
│ │  │  ┌─ Field label="Documentos solicitados" ─────────────────────────────────────────────┐    │  │ │
│ │  │  │                                                                                    │    │  │ │
│ │  │  │  Lista dinâmica de linhas (cada linha = um documento):                             │    │  │ │
│ │  │  │                                                                                    │    │  │ │
│ │  │  │  ┌──────────────────────────────────────────────────────┬────────────────────┐    │    │  │ │
│ │  │  │  │  Input placeholder="Nome do documento (ex: RG)"     │  [ × ]             │    │    │  │ │
│ │  │  │  └──────────────────────────────────────────────────────┴────────────────────┘    │    │  │ │
│ │  │  │  ┌──────────────────────────────────────────────────────┬────────────────────┐    │    │  │ │
│ │  │  │  │  Input placeholder="Nome do documento"              │  [ × ]             │    │    │  │ │
│ │  │  │  └──────────────────────────────────────────────────────┴────────────────────┘    │    │  │ │
│ │  │  │                                                                                    │    │  │ │
│ │  │  │  [ + Adicionar documento ]  ← Button variant=ghost, dashed border                │    │  │ │
│ │  │  │                               onClick → adiciona nova linha vazia                 │    │  │ │
│ │  │  │                               min 1 linha, máx ilimitado                          │    │  │ │
│ │  │  └────────────────────────────────────────────────────────────────────────────────────┘    │  │ │
│ │  │                                                                                             │  │ │
│ │  │  ┌─ Field label="Mensagem para o lead (opcional)" ────────────────────────────────────┐    │  │ │
│ │  │  │  Textarea rows=4                                                                   │    │  │ │
│ │  │  │  placeholder="Ex: Olá! Precisamos dos seguintes documentos para dar continuidade..." │  │ │
│ │  │  └────────────────────────────────────────────────────────────────────────────────────────┘ │  │ │
│ │  │                                                                                             │  │ │
│ │  └─────────────────────────────────────────────────────────────────────────────────────────────┘  │ │
│ │                                                                                                   │ │
│ │  ── ESTADO SUCESSO (aparece após gerar) ──────────────────────────────────────────────────────── │ │
│ │  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐ │ │
│ │  │  ✅  Solicitação criada!                                                                    │ │ │
│ │  │  E-mail enviado para o lead.                                                                │ │ │
│ │  │                                                                                             │ │ │
│ │  │  Link gerado:                                                                               │ │ │
│ │  │  ┌─────────────────────────────────────────────────────────┬──────────────────────┐        │ │ │
│ │  │  │  https://app.corretorstudio.com/documentos/abc123...   │  [ Copiar link  📋 ] │        │ │ │
│ │  │  └─────────────────────────────────────────────────────────┴──────────────────────┘        │ │ │
│ │  └─────────────────────────────────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                                                   │ │
│ └───────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                                       │
│ ┌─ SheetFooter (fixed, border-t p-4 flex gap-2 justify-end) ────────────────────────────────────────┐ │
│ │  [ Cancelar ]   [ Gerar link e enviar e-mail ]                                                    │ │
│ │  ↑ ghost          ↑ default, loading spinner ao submeter                                          │ │
│ │                   texto muda para "Enviando..." durante loading                                   │ │
│ │                   disabled se: nenhum documento com nome preenchido                               │ │
│ └───────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────────────────────────────┘

BADGES DE STATUS:
  Pendente → Badge variant=outline class="border-amber-500/40 bg-amber-500/10 text-amber-600"
  Parcial  → Badge variant=outline class="border-blue-500/40 bg-blue-500/10 text-blue-500"
  Completo → Badge variant=outline class="border-green-500/40 bg-green-500/10 text-green-600"
  ↑ todos usando tokens semânticos via color tokens do DESIGN, não hex direto
```

### Regras de UX

1. **Sheet abertura** → `Sheet` com `side="right"`. Animação padrão shadcn (slide from right). Foco vai para o primeiro Input ao abrir (`autoFocus`).
2. **Lista de documentos dinâmica** → mínimo 1 linha (pré-populada vazia). Botão × desabilitado quando há apenas 1 linha. Máximo sem limite de UI. Tecla `Enter` em qualquer Input de documento adiciona nova linha (ao invés de submeter).
3. **Gerar link e enviar** → clique: botão locked, spinner, texto "Enviando...". Backend: cria solicitação + gera token + envia e-mail. Ao sucesso: footer some, corpo do Sheet exibe estado de sucesso com link. Ao erro: toast error.
4. **Copiar link** → `navigator.clipboard.writeText(link)`. Toast "Link copiado!" via sonner.
5. **Fechar Sheet após sucesso** → botão "Fechar" substituindo "Cancelar" no footer. Clique fecha o Sheet E refetch da lista de solicitações na aba Documentos.
6. **Status Pendente vs Parcial vs Completo** → calculado: 0 docs enviados = Pendente; 1+ mas não todos = Parcial; todos = Completo.
7. **Reenviar e-mail** → clique em "Reenviar e-mail": loading no botão, POST ao backend. Sucesso: toast "E-mail reenviado para <email-do-lead>".
8. **Copiar link da lista** → botão ícone copy ao lado do link truncado. Comportamento idêntico ao sheet.
9. **Ordenação dos cards** → mais recente primeiro (order by `createdAt` desc).
10. **Empty state de documentos na lista** → ícone Clock + "Nenhum arquivo enviado ainda" quando um card tem 0 documentos enviados e status Pendente.
11. **Keyboard** → `Tab` entre Inputs de documentos. `Esc` fecha o Sheet (com confirmação se campos preenchidos).
12. **Loading inicial da aba** → Skeleton cards (2 retângulos tall) enquanto lista carrega.

### Componentes shadcn

| Elemento visual | Componente shadcn | Import path |
|---|---|---|
| Sheet de criação | `Sheet / SheetTrigger / SheetContent / SheetHeader / SheetTitle / SheetDescription / SheetFooter` | `@/components/ui/sheet` |
| Badge status Pendente/Parcial/Completo | `Badge` variant `outline` + className | `@/components/ui/badge` |
| Input nome do documento | `Input` | `@/components/ui/input` |
| Botão remover linha (×) | `Button` variant `ghost` size `icon` | `@/components/ui/button` |
| Botão "+ Adicionar documento" | `Button` variant `ghost` (dashed via className) | `@/components/ui/button` |
| Textarea mensagem | `Textarea` | `@/components/ui/textarea` |
| Container formulário | `FieldGroup` + `Field` | `@/components/ui/field` |
| Card de solicitação | `Card / CardHeader / CardContent / CardFooter` | `@/components/ui/card` |
| Botão "Reenviar e-mail" | `Button` variant `ghost` size `sm` | `@/components/ui/button` |
| Botão copiar link | `Button` variant `ghost` size `icon` | `@/components/ui/button` |
| Toast feedback | `sonner` | `@/components/ui/sonner` |
| Skeleton inicial | `Skeleton` | `@/components/ui/skeleton` |
| Separador section | `Separator` | `@/components/ui/separator` |

---

<a id="tela-5"></a>
## Tela 5 — Página pública `/documentos/[token]`

### Wireframe ASCII

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ VIEWPORT: sem sidebar, sem nav autenticada, fundo bg-background                                      │
│                                                                                                      │
│ ┌─ HEADER (border-b bg-card/80 backdrop-blur-sm sticky top-0) ──────────────────────────────────────┐│
│ │  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  ││
│ │  │  [  CS Logo  ]   Corretor Studio                                                           │  ││
│ │  │  ↑ 28px rounded  font-poppins font-bold                                                   │  ││
│ │  │                                                                                            │  ││
│ │  │                        Bruno Marcelino — Corretor Studio Ltda.                             │  ││
│ │  │                        ↑ text-sm text-muted-foreground, alinhado à direita                 │  ││
│ │  └────────────────────────────────────────────────────────────────────────────────────────────┘  ││
│ │  max-w-2xl mx-auto px-4 py-3 flex items-center justify-between                                   ││
│ └────────────────────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                                      │
│ ┌─ MAIN (max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6) ─────────────────────────────────────────┐│
│ │                                                                                                   ││
│ │  ┌─ HERO SECTION ────────────────────────────────────────────────────────────────────────────┐   ││
│ │  │  Solicitação de documentos                                                                │   ││
│ │  │  ↑ text-2xl font-bold font-poppins                                                        │   ││
│ │  │                                                                                           │   ││
│ │  │  "Olá! Precisamos de alguns documentos para dar continuidade ao seu processo."            │   ││
│ │  │  ↑ text-muted-foreground text-sm mt-1 (mensagem personalizada do closer)                  │   ││
│ │  └───────────────────────────────────────────────────────────────────────────────────────────┘   ││
│ │                                                                                                   ││
│ │  ┌─ PROGRESS BAR ────────────────────────────────────────────────────────────────────────────┐   ││
│ │  │  ┌───────────────────────────────────────────────────────────────────────────────────┐    │   ││
│ │  │  │  1 de 3 documentos enviados                          [████████░░░░░░░░░░░░░░] 33% │    │   ││
│ │  │  │  ↑ text-sm text-muted-foreground                      ↑ Progress component          │    │   ││
│ │  │  └───────────────────────────────────────────────────────────────────────────────────┘    │   ││
│ │  └───────────────────────────────────────────────────────────────────────────────────────────┘   ││
│ │                                                                                                   ││
│ │  ┌─ LISTA DE DOCUMENTOS (flex flex-col gap-4) ───────────────────────────────────────────────┐   ││
│ │  │                                                                                           │   ││
│ │  │  ── DOCUMENTO #1 — Estado: AGUARDANDO ──────────────────────────────────────────────── │   ││
│ │  │  ┌───────────────────────────────────────────────────────────────────────────────────┐  │   ││
│ │  │  │  bg-card border rounded-xl p-5                                                   │  │   ││
│ │  │  │                                                                                   │  │   ││
│ │  │  │  ┌── flex items-start justify-between ──────────────────────────────────────────┐│  │   ││
│ │  │  │  │  📄  RG ou CNH (frente e verso)                          [ Aguardando ]      ││  │   ││
│ │  │  │  │      font-semibold text-foreground               ↑ Badge variant=secondary   ││  │   ││
│ │  │  │  │      mt-1: text-xs text-muted-foreground                                     ││  │   ││
│ │  │  │  │      "Frente e verso, documento válido"                                       ││  │   ││
│ │  │  └──────────────────────────────────────────────────────────────────────────────────┘│  │   ││
│ │  │  │                                                                                   │  │   ││
│ │  │  │  ┌─── ZONA DE UPLOAD ────────────────────────────────────────────────────────────┐│  │   ││
│ │  │  │  │                                                                               ││  │   ││
│ │  │  │  │  ┌─────────────────────────────────────────────────────────────────────────┐ ││  │   ││
│ │  │  │  │  │                         ⬆ Upload                                        │ ││  │   ││
│ │  │  │  │  │                                                                         │ ││  │   ││
│ │  │  │  │  │        Arraste e solte ou clique para selecionar                        │ ││  │   ││
│ │  │  │  │  │        PNG, JPG, PDF — Máx. 10MB                                        │ ││  │   ││
│ │  │  │  │  │                                                                         │ ││  │   ││
│ │  │  │  │  └─────────────────────────────────────────────────────────────────────────┘ ││  │   ││
│ │  │  │  │  ↑ border border-dashed rounded-xl p-6 text-center cursor-pointer             ││  │   ││
│ │  │  │  │    bg-muted/30, hover: border-primary bg-primary/5                            ││  │   ││
│ │  │  │  │    drag-over: border-primary bg-primary/10 ring-2 ring-primary/30             ││  │   ││
│ │  │  │  │    input file hidden, aceita múltiplos arquivos                               ││  │   ││
│ │  │  │  └───────────────────────────────────────────────────────────────────────────────┘│  │   ││
│ │  │  └───────────────────────────────────────────────────────────────────────────────────┘  │   ││
│ │  │                                                                                           │   ││
│ │  │  ── DOCUMENTO #2 — Estado: ENVIADO ─────────────────────────────────────────────────── │   ││
│ │  │  ┌───────────────────────────────────────────────────────────────────────────────────┐  │   ││
│ │  │  │  bg-card border border-green-500/30 rounded-xl p-5                               │  │   ││
│ │  │  │                                                                                   │  │   ││
│ │  │  │  ┌── flex items-start justify-between ──────────────────────────────────────────┐│  │   ││
│ │  │  │  │  📄  Carteirinha do plano atual                    [ ✅ Enviado ]            ││  │   ││
│ │  │  │  │                                                  ↑ Badge verde               ││  │   ││
│ │  │  │  └──────────────────────────────────────────────────────────────────────────────┘│  │   ││
│ │  │  │                                                                                   │  │   ││
│ │  │  │  ┌─── ARQUIVO ENVIADO ────────────────────────────────────────────────────────────┐│  │   ││
│ │  │  │  │                                                                               ││  │   ││
│ │  │  │  │  ✅  carteirinha_plano.pdf          Enviado em 29 jul às 14:38               ││  │   ││
│ │  │  │  │      ↑ CheckCircle text-green-500   ↑ text-xs text-muted-foreground          ││  │   ││
│ │  │  │  │                                                                               ││  │   ││
│ │  │  │  │  [ Substituir arquivo ]  ← Button variant=ghost size=sm text-xs              ││  │   ││
│ │  │  │  └───────────────────────────────────────────────────────────────────────────────┘│  │   ││
│ │  │  └───────────────────────────────────────────────────────────────────────────────────┘  │   ││
│ │  │                                                                                           │   ││
│ │  │  ── DOCUMENTO #3 — Estado: ENVIANDO (loading) ─────────────────────────────────────── │   ││
│ │  │  ┌───────────────────────────────────────────────────────────────────────────────────┐  │   ││
│ │  │  │  bg-card border rounded-xl p-5                                                   │  │   ││
│ │  │  │                                                                                   │  │   ││
│ │  │  │  ┌─── PROGRESSO DE UPLOAD ────────────────────────────────────────────────────────┐│  │   ││
│ │  │  │  │                                                                               ││  │   ││
│ │  │  │  │  📎  comprovante_residencia.pdf                                               ││  │   ││
│ │  │  │  │  [████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 45%                          ││  │   ││
│ │  │  │  │  ↑ Progress component, valor animado                                          ││  │   ││
│ │  │  │  │  text-xs text-muted-foreground "Enviando..."                                  ││  │   ││
│ │  │  │  └───────────────────────────────────────────────────────────────────────────────┘│  │   ││
│ │  │  └───────────────────────────────────────────────────────────────────────────────────┘  │   ││
│ │  └───────────────────────────────────────────────────────────────────────────────────────────┘   ││
│ │                                                                                                   ││
│ │  ══════════════════════════════════════════════════════════════════════════════════════════════   ││
│ │  ESTADO ESPECIAL A — TOKEN INVÁLIDO / EXPIRADO                                                   ││
│ │  ══════════════════════════════════════════════════════════════════════════════════════════════   ││
│ │                                                                                                   ││
│ │  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐ ││
│ │  │                                                                                             │ ││
│ │  │   ⚠  Link inválido ou expirado                                                             │ ││
│ │  │      Este link não é mais válido. Solicite ao seu corretor um novo link.                   │ ││
│ │  │                                                                                             │ ││
│ │  │                    [ Falar com o corretor pelo WhatsApp ]                                  │ ││
│ │  │                     ↑ Button variant=default (se phone disponível no token)                │ ││
│ │  │                                                                                             │ ││
│ │  └─────────────────────────────────────────────────────────────────────────────────────────────┘ ││
│ │  ↑ bg-destructive/8 border-destructive/20 rounded-xl p-8 text-center max-w-md mx-auto            ││
│ │                                                                                                   ││
│ │  ══════════════════════════════════════════════════════════════════════════════════════════════   ││
│ │  ESTADO ESPECIAL B — TODOS OS DOCUMENTOS ENVIADOS (confirmação)                                  ││
│ │  ══════════════════════════════════════════════════════════════════════════════════════════════   ││
│ │                                                                                                   ││
│ │  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐ ││
│ │  │                                                                                             │ ││
│ │  │   🎉  Obrigado!                                                                            │ ││
│ │  │       Todos os documentos foram enviados com sucesso.                                      │ ││
│ │  │       Bruno Marcelino entrará em contato em breve.                                         │ ││
│ │  │                                                                                             │ ││
│ │  │   [████████████████████████████████████████████████] 100%                                 │ ││
│ │  │                                                                                             │ ││
│ │  │              ✅ 3 de 3 documentos enviados                                                │ ││
│ │  │                                                                                             │ ││
│ │  └─────────────────────────────────────────────────────────────────────────────────────────────┘ ││
│ │  ↑ bg-green-500/8 border-green-500/20 rounded-xl p-8 text-center max-w-md mx-auto               ││
│ │                                                                                                   ││
│ └───────────────────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                                      │
│ ┌─ FOOTER (border-t mt-8 py-4 text-center) ─────────────────────────────────────────────────────────┐│
│ │  text-xs text-muted-foreground                                                                    ││
│ │  "Protegido · Corretor Studio · Seus dados estão seguros"                                         ││
│ └────────────────────────────────────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Regras de UX

1. **Token de acesso** → URL `/documentos/[token]` é pública (sem autenticação). O token é UUID ou slug opaco. Servidor verifica: existência, expiração, uso. Token inválido → exibe estado de erro imediatamente (sem redirecionar).
2. **Drag & Drop** → cada zona de upload aceita `dragenter/dragover/dragleave/drop`. `dragover` previne comportamento padrão. Arquivo dropado inicia upload imediatamente. Múltiplos arquivos: apenas o primeiro é usado (ou exibir todos, conforme regra de negócio).
3. **Clique na zona de upload** → dispara `input[type=file]` hidden. Aceita PNG, JPG, JPEG, PDF. `multiple=false` por documento. Max 10MB — validado no client antes do upload, com mensagem inline de erro (sem toast, para não assustar o lead).
4. **Upload flow** → `FormData + fetch`. Progress calculado via `XMLHttpRequest` `onprogress` ou via chunks. Enquanto enviando: zona de upload substituída por barra de progresso animada + nome do arquivo. Erro de upload: mensagem inline no card + botão "Tentar novamente".
5. **Estado enviado** → card ganha `border-green-500/30`. Badge muda para "Enviado" verde. Zona de upload substituída por nome do arquivo + data + botão "Substituir arquivo".
6. **Substituir arquivo** → clique em "Substituir arquivo" reabre o input file. Arquivo anterior é sobrescrito (DELETE + PUT no backend).
7. **Progress bar global** → atualiza a cada mudança de estado de documento (reat state). Transição CSS `transition-all duration-500`.
8. **Estado todos enviados** → quando count enviados === total, a UI inteira é substituída pela tela de confirmação com animação `confetti` opcional via CSS ou biblioteca leve. A página NÃO redireciona.
9. **Token expirado** → detectado no `getServerSideProps` ou API route inicial. Renderiza estado de erro. Botão "Falar com corretor" só aparece se o token ainda contém o telefone do closer no payload (mesmo inválido por expiração).
10. **Mobile first** → `max-w-2xl` garante leitura confortável em mobile. Zona de upload: mínimo 120px de altura, `min-h-[120px]`. Botões com altura mínima de 44px.
11. **Acessibilidade** → zona de upload tem `role="button" tabIndex={0} aria-label="Enviar [nome do documento]"`. Progress: `<progress>` semântico ou `role="progressbar" aria-valuenow aria-valuemax`.
12. **SEO/meta** → `<title>` dinâmico: "Envio de documentos — Corretor Studio". `noindex nofollow` nas meta tags (página privada por token).
13. **Loading inicial** → Skeleton de 3 cards enquanto fetch do token carrega. Nunca spinner de tela cheia.
14. **Sem autenticação** → nenhum cookie de sessão necessário. O token é a única credencial. CSRF não aplicável (formulário de upload usa token na URL).

### Componentes shadcn

| Elemento visual | Componente shadcn | Import path |
|---|---|---|
| Progress bar global | `Progress` | `@/components/ui/progress` |
| Progress de upload individual | `Progress` | `@/components/ui/progress` |
| Badge "Aguardando" | `Badge` variant `secondary` | `@/components/ui/badge` |
| Badge "Enviado" | `Badge` variant `outline` + className verde | `@/components/ui/badge` |
| Card de documento | `Card / CardContent` | `@/components/ui/card` |
| Botão "Substituir arquivo" | `Button` variant `ghost` size `sm` | `@/components/ui/button` |
| Botão "Falar com corretor" | `Button` variant `default` | `@/components/ui/button` |
| Skeleton inicial | `Skeleton` | `@/components/ui/skeleton` |
| Separador | `Separator` | `@/components/ui/separator` |
| Alert erro token | `Alert / AlertDescription` (variant `destructive`) | `@/components/ui/alert` |

---

## Apêndice — Tokens Semânticos Referenciados

Todos os valores abaixo são tokens do `DESIGN.md` / `globals.css`. **Nunca use hex direto.**

| Alias usado na spec | Token CSS | Uso |
|---|---|---|
| `bg-card` | `hsl(var(--card))` | Superfície de card |
| `bg-background` | `hsl(var(--background))` | Fundo da página |
| `bg-muted` | `hsl(var(--muted))` | Superfície neutra suave |
| `text-foreground` | `hsl(var(--foreground))` | Texto principal |
| `text-muted-foreground` | `hsl(var(--muted-foreground))` | Texto secundário/auxiliar |
| `border` | `hsl(var(--border))` | Borda padrão |
| `ring` | `hsl(var(--ring))` | Ring de foco |
| `bg-primary` | `hsl(var(--primary))` | CTA principal (orange) |
| `text-primary` | `hsl(var(--primary))` | Texto primário |
| `bg-destructive` | `hsl(var(--destructive))` | Erro/danger |
| `text-destructive` | `hsl(var(--destructive))` | Texto de erro |
| `bg-accent` | `hsl(var(--accent))` | Hover interativo |

### Regra de cor dinâmica de tags

```
/* bg do chip */
background: color-mix(in srgb, <hex-stored-in-db> 18%, transparent);

/* border do chip */
border-color: color-mix(in srgb, <hex-stored-in-db> 40%, transparent);

/* texto do chip */
color: <hex-stored-in-db>;
```

Nunca mapear cor de tag para um token semântico fixo — a cor é configurável pelo time.

---

## Apêndice — Mapa de Abas do LeadDialog (após reforma)

```
LEFT PANEL — TabsList
┌────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  [ Dados ]  [ Beneficiários ]  [ Anexos ]  [ Tags N ]  [ Contatos N ]  [ Documentos N ]            │
│      ↑                              ↑             ↑           ↑                  ↑                  │
│   existente                     existente      NOVA        NOVA              NOVA                   │
│   sem mudança                  sem mudança    purple       blue              primary                 │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘

Valor do Tab count badge:
  Tags       → número de tags aplicadas no lead
  Contatos   → número de contatos registrados
  Documentos → número de solicitações ativas (não arquivadas)

Tab count badge colors:
  Tags:       bg-purple-500/15 text-purple-400  (quando ativo)
              bg-muted text-muted-foreground     (quando inativo)
  Contatos:   bg-blue-500/15 text-blue-400       (quando ativo)
              bg-muted text-muted-foreground      (quando inativo)
  Documentos: bg-primary/15 text-primary         (quando ativo)
              bg-muted text-muted-foreground      (quando inativo)
```

---

*Fim do spec — Agente 1 (backend) e Agente 2 (frontend) devem ler este documento antes de iniciar implementação.*
