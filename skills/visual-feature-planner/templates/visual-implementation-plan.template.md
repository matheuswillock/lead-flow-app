# Plano de Implementação Visual — [NomeDaFeature]

**Feature:** [NomeDaFeature]
**Rota:** `app/[supabaseId]/[segmento-da-rota]/`  *(ex: `leads/timeline` — sem o prefixo `app/[supabaseId]/`)*
**Público:** [manager | operator | backoffice | lead | visitante]
**Objetivo de conversão:** [ação principal que o usuário deve realizar]
**Data do plano:** [YYYY-MM-DD]
**Status:** PRONTO PARA IMPLEMENTAÇÃO

---

## 1. Design Brief

> Gerado via skill `corretor-studio-design`. Não editar manualmente.

```json
{
  "contexto": {
    "tipo_tela": "",
    "objetivo_conversao": "",
    "publico": "",
    "restricoes": []
  },
  "direcao_visual": {
    "visual_dna": "Hybrid Warm-Precision",
    "narrativa_interface": "",
    "hierarquia_cta": ""
  },
  "tokens": {
    "surface": [],
    "brand": [],
    "precision": [],
    "semantic": [],
    "motion": []
  },
  "layout": {
    "estrutura": "",
    "grade": "",
    "espacamento": "",
    "responsividade": []
  },
  "componentes": [
    {
      "nome": "",
      "base": "shadcn",
      "mcp_consultado": true,
      "variantes": [],
      "estados": []
    }
  ],
  "acessibilidade": {
    "contraste": "",
    "foco_visivel": true,
    "touch_target_minimo": "44x44",
    "reduced_motion": true
  },
  "copy_direcao": {
    "tom": "",
    "microcopy_cta": [],
    "mensagens_apoio": []
  },
  "assuncoes": []
}
```

---

## 2. Estrutura de arquivos a criar

```
app/[supabaseId]/[segmento-da-rota]/                # ex: app/[supabaseId]/leads/timeline/
├── page.tsx                                    # Thin: Provider + Container
├── loading.tsx                                 # Skeleton da rota
└── features/
    ├── context/
    │   ├── [Feature]Types.ts                   # I[Feature]State, I[Feature]Actions, I[Feature]Context
    │   ├── [Feature]Hook.ts                    # Orquestração, estado, useCallback
    │   └── [Feature]Context.tsx                # createContext + Provider + consumer hook
    ├── services/
    │   ├── I[Feature]Service.ts                # Contrato do serviço
    │   └── [Feature]Service.ts                 # Implementação + singleton
    ├── container/
    │   ├── [Feature]Container.tsx              # Composição principal
    │   ├── [Feature]Header.tsx                 # [se necessário]
    │   └── [Feature]Dialog.tsx                 # [se necessário]
    └── components/                             # [subcomponentes opcionais]
```

---

## 3. Componentes shadcn a instalar

| Componente | Comando de instalação | Variante/uso |
|---|---|---|
| [ComponenteA] | `bunx --bun shadcn@latest add [componente-a]` | [uso previsto] |
| [ComponenteB] | `bunx --bun shadcn@latest add [componente-b]` | [uso previsto] |

> Todos os componentes foram verificados via `shadcn:search_items_in_registries` e `shadcn:view_items_in_registries`.

---

## 4. Tokens e classes a usar

| Elemento | Token / Classe | Justificativa |
|---|---|---|
| Superfície principal | `--surface-1` | [motivo] |
| CTA primário | `bg-primary text-primary-foreground` | [motivo] |
| Status | `--semantic-[success|warning|danger|info]` | [motivo] |
| Texto secundário | `text-muted-foreground` | [motivo] |
| Animação | `--motion-duration-[fast|base|slow]` | [motivo] |

---

## 5. Plano de componentes (ordem de implementação)

### 5.1 [Feature]Container — composição raiz

**Responsabilidade:** Orquestrar os subcomponentes, consumir o contexto, renderizar loading/error.

**Props recebidas:** nenhuma (consome `use[Feature]Context()`)

**Estados a tratar:**
- Loading → `<[Feature]Skeleton />`
- Erro → `<[Feature]Error error={error} onRetry={fetchItems} />`
- Sucesso → layout principal

**Estrutura JSX prevista:**
```tsx
<div className="flex flex-col gap-6">
  <[Feature]Header />
  <[Feature]List items={items} />
</div>
```

---

### 5.2 [Feature]Header — cabeçalho da tela

**Responsabilidade:** Título, subtítulo, botão de ação principal.

**Componentes shadcn:** `Button` (primary, pill-cta ou default conforme hierarquia)

**Tokens:** `--surface-0`, `bg-primary`

---

### 5.3 [Feature]List / [Feature]Table — listagem de dados

**Responsabilidade:** Renderizar a coleção de itens.

**Componentes shadcn:** `Table` ou `Card` (conforme tipo de dado)

**Estados:**
- Vazio → mensagem de empty state com CTA
- Populado → lista/tabela com itens

---

### 5.4 [Feature]Dialog — modal de criação/edição

**Responsabilidade:** Formulário de criação ou edição de item.

**Componentes shadcn:** `Dialog`, `FieldGroup`, `Field`, `Input`, `Button`

**Regras:**
- `DialogContent` com `max-h-[90vh] flex flex-col`
- Campos em `overflow-y-auto flex-1`
- `DialogFooter` fixo fora da área rolável
- Botão de submit travado no primeiro clique (loading lock)

---

### 5.5 [Feature]Skeleton — loading state

**Responsabilidade:** Placeholder visual durante carregamento.

**Componentes shadcn:** `Skeleton`

**Nunca:** `animate-pulse` manual.

---

## 6. Checklist de conformidade visual

- [ ] Tokens semânticos usados (sem hex hardcoded em UI tematizável)
- [ ] Tipografia `Poppins` (app) respeitada
- [ ] Todos os componentes shadcn consultados via MCP antes de criar markup
- [ ] CTA primário com hierarquia inequívoca
- [ ] Light/dark consistentes com o contrato do `DESIGN.md`
- [ ] Motion usa `--motion-*` e respeita `prefers-reduced-motion`
- [ ] Sem edição manual de regiões gerenciadas por `design:sync`
- [ ] `DialogContent` com scroll support quando conteúdo pode transbordar
- [ ] `Avatar` sempre com `AvatarFallback`
- [ ] `Skeleton` para loading — sem `animate-pulse` manual
- [ ] `Badge` para status — sem `span` customizado
- [ ] `sonner` para toasts — sem `window.alert`
- [ ] `AlertDialog` para confirmações — sem `window.confirm`

---

## 7. Checklist de arquitetura frontend

- [ ] `page.tsx` thin (só Provider + Container)
- [ ] `use[Feature]Context()` usado no Container — sem prop drilling
- [ ] `useParams()` para `supabaseId` — sem props drilling
- [ ] Service com interface `I[Feature]Service` + implementação + singleton
- [ ] Hook com `useCallback` em todas as funções de fetch/mutation
- [ ] Data-fetching com deduplicação (in-flight guard + last-success guard)
- [ ] Mutations com lock/unlock no `finally`
- [ ] TypeScript strict — sem `any` implícito
- [ ] Sem `*_IMPLEMENTATION_SUMMARY.md` ou similar

---

## 8. Sequência de validação pós-implementação

```bash
bun run typecheck 2>&1 | head -20
bun run lint
bun run governance:check
bun run design:check
```

Se `design:check` falhar: `bun run design:sync` e commitar o resultado.

---

## 9. Formato de commit

```
feat([feature]): implement [feature] frontend

- Add [Feature]Context with Types, Hook, Provider
- Add [Feature]Service with interface and singleton
- Add [Feature]Container with loading/error states
- Add [Feature]Dialog for create/edit actions
- Add [Feature]Skeleton for loading state

Closes #[issue]
```
