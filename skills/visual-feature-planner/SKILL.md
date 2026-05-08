---
name: visual-feature-planner
description: Orquestra as skills corretor-studio-design e corretor-studio-frontend para produzir um plano completo de implementação de componentes visuais de uma feature. Gera o design brief, mapeia componentes shadcn, define tokens, estrutura os arquivos e produz checklists de conformidade — tudo pronto para ser implementado em um segundo momento. Use antes de qualquer implementação visual nova no Corretor Studio.
---

# Visual Feature Planner — Corretor Studio

Produz um **plano de implementação visual completo** para uma feature do Corretor Studio, orquestrando as skills `corretor-studio-design` e `corretor-studio-frontend`. O output é um documento Markdown estruturado, pronto para ser executado por qualquer agente ou desenvolvedor em uma sessão separada.

> Esta skill é de **planejamento**, não de implementação. Nenhum arquivo de código é criado aqui.

---

## Quando usar esta skill

- Antes de implementar qualquer tela, modal, formulário ou seção nova.
- Quando o usuário descreve uma feature e pede um plano antes de codar.
- Quando a feature envolve múltiplos componentes visuais que precisam de coordenação.
- Quando o plano será revisado pelo time antes da implementação.

---

## Processo obrigatório (5 passos)

1. Coletar o briefing da feature
2. Executar o processo da skill `corretor-studio-design` (Passos 1–4)
3. Executar o processo da skill `corretor-studio-frontend` (Passos 1–2, sem implementar)
4. Montar o plano de implementação visual
5. Entregar o documento de plano

---

## Passo 1 — Coletar o briefing da feature

Antes de qualquer análise, extrair ou confirmar os seguintes campos do usuário:

| Campo | Descrição | Exemplo |
|---|---|---|
| `nome_feature` | Nome da feature em PascalCase | `LeadTimeline` |
| `rota` | Caminho da rota no app | `app/[supabaseId]/leads/timeline/` |
| `tipo_tela` | landing, dashboard, modal, formulário, fluxo | `dashboard` |
| `objetivo_conversao` | Ação principal que o usuário deve realizar | `Visualizar histórico de atividades do lead` |
| `publico` | manager, operator, backoffice, lead, visitante | `operator` |
| `restricoes` | Técnicas, de conteúdo, prazo, acessibilidade | `["Sem acesso a dados de outros times"]` |

Se algum campo estiver ausente, assumir o mínimo necessário e declarar no campo `assuncoes` do plano.

---

## Passo 2 — Executar skill `corretor-studio-design` (Passos 1–4)

Seguir os Passos 1 a 4 da skill `corretor-studio-design` **sem pular nenhum**:

### 2.1 — Ler as fontes canônicas

Ler nesta ordem:

| Prioridade | Fonte | O que extrai |
|---|---|---|
| 1 | `DESIGN.md` | Tokens, tipografia, superfícies, motion, anti-padrões |
| 2 | `app/globals.css` | Classes utilitárias, regiões gerenciadas |
| 3 | `agents.md` (seção Visual Implementation) | Regras obrigatórias de shadcn e design:check |

Se houver conflito, **prevalece o `DESIGN.md`**.

### 2.2 — Consultar shadcn via MCP

Para cada componente identificado no briefing, executar a sequência obrigatória:

```
1. shadcn:search_items_in_registries  → buscar o componente pelo nome
2. shadcn:view_items_in_registries    → inspecionar API completa e variantes
3. shadcn:get_add_command_for_items   → obter o comando de instalação
```

Registrar no plano: nome do componente, comando de instalação e variante/uso previsto.

Só propor markup customizado se o componente **não existir** no registry.

### 2.3 — Interpretar o briefing

Mapear os campos coletados no Passo 1 para as decisões visuais:

- `tipo_tela` → estrutura de layout (bento, lista, tabela, formulário)
- `objetivo_conversao` → hierarquia de CTA (qual botão é primário, qual é secundário)
- `publico` → tom de copy e densidade de informação
- `restricoes` → limitações de componentes ou tokens

### 2.4 — Compor tokens, layout e componentes

Definir para a feature:

**Tokens a usar** (nunca hex hardcoded):

| Elemento | Token semântico |
|---|---|
| Superfície principal | `--surface-[0-4]` conforme profundidade |
| CTA primário | `bg-primary text-primary-foreground` |
| Status/badges | `--semantic-[success|warning|danger|info|new]` |
| Texto secundário | `text-muted-foreground` |
| Destaque fintech | `--precision-indigo` / `--precision-*` |
| Animações | `--motion-duration-*` / `--motion-ease-*` |

**Regras de composição obrigatórias:**
- `FieldGroup` + `Field` em formulários — nunca `div` com `space-y-*`
- `gap-*` em vez de `space-y-*` / `space-x-*`
- `size-*` quando largura = altura
- `cn()` de `@/lib/utils` para classes condicionais
- `Skeleton` para loading — nunca `animate-pulse` manual
- `Badge` para status — nunca `span` customizado
- `Separator` em vez de `<hr>` ou `border-t`
- `sonner` para toasts — nunca `window.alert`
- `AlertDialog` para confirmações — nunca `window.confirm`
- `DialogContent` com `max-h-[90vh] flex flex-col` quando conteúdo pode transbordar

---

## Passo 3 — Executar skill `corretor-studio-frontend` (Passos 1–2, sem implementar)

Seguir os Passos 1 e 2 da skill `corretor-studio-frontend` para **mapear** (não implementar):

### 3.1 — Verificar código similar

Verificar se já existe feature similar em:
- `app/[supabaseId]/dashboard/` — referência de Context SOLID completo
- `app/[supabaseId]/board/` — referência de Container patterns
- `app/[supabaseId]/manager-users/` — referência de Service patterns

Registrar no plano: features similares encontradas e o que pode ser reutilizado.

### 3.2 — Mapear a estrutura de arquivos

Definir a árvore completa de arquivos a criar, seguindo a estrutura canônica:

```
app/[supabaseId]/[rota]/
├── page.tsx                          # Thin: só Provider + Container
├── loading.tsx                       # Loading UI da rota
└── features/
    ├── context/
    │   ├── [Feature]Types.ts         # I[Feature]State, I[Feature]Actions, I[Feature]Context
    │   ├── [Feature]Hook.ts          # Orquestração, estado, useCallback
    │   └── [Feature]Context.tsx      # createContext + Provider + consumer hook
    ├── services/
    │   ├── I[Feature]Service.ts      # Contrato do serviço
    │   └── [Feature]Service.ts       # Implementação + singleton
    ├── container/
    │   ├── [Feature]Container.tsx    # Composição principal
    │   ├── [Feature]Header.tsx       # [se necessário]
    │   └── [Feature]Dialog.tsx       # [se necessário]
    └── components/                   # [subcomponentes opcionais]
```

Para cada arquivo, descrever:
- **Responsabilidade** — o que o arquivo faz
- **Dependências** — o que importa
- **Interface pública** — o que exporta

---

## Passo 4 — Montar o plano de implementação visual

Usar o template `templates/visual-implementation-plan.template.md` como base.

Preencher **todas** as seções do template:

| Seção | O que preencher |
|---|---|
| **1. Design Brief** | JSON completo gerado no Passo 2 |
| **2. Estrutura de arquivos** | Árvore real com nomes da feature |
| **3. Componentes shadcn** | Tabela com comando de instalação e uso |
| **4. Tokens e classes** | Tabela com elemento → token → justificativa |
| **5. Plano de componentes** | Descrição detalhada de cada componente |
| **6. Checklist visual** | Marcar os itens aplicáveis à feature |
| **7. Checklist de arquitetura** | Marcar os itens aplicáveis à feature |
| **8. Sequência de validação** | Comandos a rodar após implementação |
| **9. Formato de commit** | Mensagem de commit pré-preenchida |

**Regras de preenchimento:**
- Substituir todos os placeholders `[Feature]`, `[rota-da-feature]`, `[NomeDaFeature]` pelos valores reais.
- Remover seções de componentes que não se aplicam (ex: sem Dialog se não há formulário).
- Adicionar seções extras se a feature tiver subcomponentes não cobertos pelo template.
- Declarar todas as assunções feitas no campo `assuncoes` do Design Brief JSON.

---

## Passo 5 — Entregar o documento de plano

Salvar o plano como:

```
docs/feature-plans/[nome-da-feature]-visual-plan.md
```

Ou, se o usuário preferir, entregar diretamente no chat como Markdown.

O documento entregue deve estar **100% pronto para implementação**, sem TODOs em aberto.

Ao entregar, incluir um resumo executivo com:
- Nome da feature e rota
- Número de arquivos a criar
- Componentes shadcn a instalar (com comandos)
- Estimativa de complexidade: Simples (1–3 componentes) / Médio (4–6) / Complexo (7+)

---

## Checklist de saída (o plano está pronto quando)

- [ ] Design Brief JSON preenchido sem campos vazios
- [ ] Todos os componentes shadcn verificados via MCP
- [ ] Árvore de arquivos com nomes reais da feature
- [ ] Cada componente tem responsabilidade, dependências e interface pública descritas
- [ ] Tokens mapeados para cada elemento visual
- [ ] Checklists de conformidade visual e arquitetura preenchidos
- [ ] Sequência de validação incluída
- [ ] Formato de commit pré-preenchido
- [ ] Nenhum placeholder `[Feature]` ou `[rota]` restante no documento

---

## Anti-padrões (MUST NOT)

- Criar arquivos de código durante o planejamento — esta skill é somente de plano.
- Entregar plano com TODOs ou campos vazios.
- Propor componentes customizados sem verificar o registry shadcn via MCP primeiro.
- Usar hex hardcoded no plano — sempre tokens semânticos.
- Pular a leitura do `DESIGN.md` antes de propor tokens e layout.
- Pular a verificação de features similares antes de propor a estrutura de arquivos.
