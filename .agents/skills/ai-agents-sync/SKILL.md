---
name: ai-agents-sync
description: Replica instruções de IA e skills do Corretor Studio para todos os agentes suportados (Cursor, GitHub Copilot, Claude Code, Codex/OpenAI e Manus AI). Cobre o fluxo completo de edição canônica, sincronização de adapters de governança e sincronização de skills. Use sempre que agents.md, skills/*.md ou qualquer instrução de IA for criada ou modificada.
---

# AI Agents Sync — Corretor Studio

Propaga regras de governança e skills para todos os agentes de IA suportados no projeto lead-flow-app, mantendo consistência entre ambientes.

## Arquitetura de sincronização

O projeto usa dois sistemas paralelos de sincronização, ambos com **fonte canônica única**:

| Sistema | Fonte canônica | Adapters gerados | Comando |
|---|---|---|---|
| **Governança** | `agents.md` | `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `.cursor/rules/lead-flow-agents.mdc` | `bun run governance:sync` |
| **Skills** | `.claude/skills/*.md` | `.cursor/skills/*.mdc`, `.github/prompts/*.prompt.md` | `bun run skills:sync` |

> **NUNCA editar os adapters gerados diretamente.** Toda mudança parte da fonte canônica.

---

## Mapeamento de agentes

| Agente | Arquivo de governança | Arquivo de skills | Formato |
|---|---|---|---|
| **Claude Code** | `CLAUDE.md` | `.claude/skills/*.md` | Markdown puro |
| **Codex (OpenAI)** | `AGENTS.md` | via `.github/prompts/` | Markdown puro |
| **GitHub Copilot** | `.github/copilot-instructions.md` | `.github/prompts/*.prompt.md` | frontmatter `mode: agent` |
| **Cursor** | `.cursor/rules/lead-flow-agents.mdc` | `.cursor/skills/*.mdc` | frontmatter MDC |
| **Manus AI** | `agents.md` (lê diretamente) | `skills/*.md` (lê diretamente) | Markdown puro |

---

## Processo obrigatório (4 passos)

### Passo 1 — Identificar o que mudou

Antes de sincronizar, identificar a natureza da mudança:

- **Mudança de regra de governança** → editar `agents.md` e rodar `governance:sync`
- **Nova skill ou atualização de skill** → editar `.claude/skills/<nome>.md` e rodar `skills:sync`
- **Ambos** → editar ambas as fontes e rodar os dois comandos

### Passo 2 — Editar a fonte canônica

#### Para regras de governança (`agents.md`)

```
agents.md  ← EDITAR AQUI
```

Regras obrigatórias ao editar `agents.md`:
- Atualizar `**Version:**` (incrementar patch ou minor conforme impacto).
- Atualizar `**Last Updated:**` com a data atual no formato `YYYY-MM-DD`.
- Manter as keywords obrigatórias: `MUST`, `SHOULD`, `LEGACY EXCEPTIONS`, `FOR NEW FEATURES`.
- Nunca remover seções existentes sem justificativa explícita do owner.

#### Para skills (`.claude/skills/<nome>.md`)

```
.claude/skills/<nome>.md  ← EDITAR AQUI
```

Formato obrigatório de cada skill:

```markdown
---
description: Descrição curta da skill (usada como título nos adapters)
---

[Conteúdo da skill em Markdown]
```

Para **adicionar uma nova skill**:
1. Criar `.claude/skills/<nome>.md` com frontmatter `description`.
2. Rodar `bun run skills:sync` para gerar os adapters.
3. Verificar que os adapters foram criados em `.cursor/skills/` e `.github/prompts/`.

Para **skills exclusivas do Manus AI** (que usam `manus-mcp-cli` ou ferramentas nativas):
- Manter em `skills/<nome>/SKILL.md` (diretório raiz de skills do Manus).
- Registrar em `skills-lock.json`.
- Adicionar nota de compatibilidade de ambiente no passo que usa `manus-mcp-cli`:

```markdown
> **Compatibilidade de ambiente:**
> O comando `manus-mcp-cli` está disponível apenas no ambiente Manus AI
> (`/usr/local/bin/manus-mcp-cli`). Em outros agentes, use o servidor MCP
> configurado em `.mcp.json` com a ferramenta equivalente:
> - **Claude Code / Cursor**: `mcp__supabase__execute_sql` via interface MCP nativa.
> - **Codex (OpenAI)**: integração MCP do workspace com endpoint `supabase` de `.mcp.json`.
```

### Passo 3 — Rodar a sincronização

#### Sincronizar governança

```bash
bun run governance:sync
```

Adapters atualizados:
- `CLAUDE.md` — Claude Code
- `AGENTS.md` — Codex (OpenAI)
- `.github/copilot-instructions.md` — GitHub Copilot
- `.cursor/rules/lead-flow-agents.mdc` — Cursor

#### Sincronizar skills

```bash
bun run skills:sync
```

Adapters atualizados:
- `.cursor/skills/<nome>.mdc` — Cursor
- `.github/prompts/<nome>.prompt.md` — GitHub Copilot

#### Sincronizar ambos (quando agents.md e skills mudaram juntos)

```bash
bun run governance:sync && bun run skills:sync
```

### Passo 4 — Validar e commitar

```bash
bun run governance:check
```

O check valida:
- Todos os adapters estão em sincronia com `agents.md`.
- `agents.md` contém as keywords obrigatórias.
- `agents.md` tem `**Version:**` e `**Last Updated:**` válidos.

Se o check falhar, rodar o sync novamente e não commitar até passar.

Formato de commit obrigatório:

```
docs(agents): <descrição da mudança de governança>

- Atualiza agents.md versão X.Y.Z
- Propaga para CLAUDE.md, AGENTS.md, copilot-instructions.md, lead-flow-agents.mdc
- [Listar as regras adicionadas/modificadas]
```

Ou para skills:

```
docs(skills): add/update <nome-da-skill> skill

- Atualiza .claude/skills/<nome>.md
- Propaga para .cursor/skills/<nome>.mdc e .github/prompts/<nome>.prompt.md
- [Descrever o que a skill faz]
```

---

## Referência de arquivos por agente

### Claude Code

| Arquivo | Tipo | Editável? |
|---|---|---|
| `CLAUDE.md` | Governança | Gerado — editar `agents.md` |
| `.claude/skills/*.md` | Skills | Fonte canônica |

### Codex (OpenAI)

| Arquivo | Tipo | Editável? |
|---|---|---|
| `AGENTS.md` | Governança | Gerado — editar `agents.md` |
| `.github/prompts/*.prompt.md` | Skills | Gerado — editar `.claude/skills/` |

### GitHub Copilot

| Arquivo | Tipo | Editável? |
|---|---|---|
| `.github/copilot-instructions.md` | Governança | Gerado — editar `agents.md` |
| `.github/prompts/*.prompt.md` | Skills | Gerado — editar `.claude/skills/` |
| `.github/instructions/*.instructions.md` | Contexto | Editável diretamente |

### Cursor

| Arquivo | Tipo | Editável? |
|---|---|---|
| `.cursor/rules/lead-flow-agents.mdc` | Governança | Gerado — editar `agents.md` |
| `.cursor/skills/*.mdc` | Skills | Gerado — editar `.claude/skills/` |

### Manus AI

| Arquivo | Tipo | Editável? |
|---|---|---|
| `agents.md` | Governança | Fonte canônica |
| `skills/<nome>/SKILL.md` | Skills exclusivas | Fonte canônica |
| `skills-lock.json` | Registro de skills | Atualizar ao adicionar skills |

---

## Configuração de adapters (`.governance/ai-governance.config.json`)

Para **adicionar um novo agente** ao sistema de governança, editar o array `adapters`:

```json
{
  "adapters": [
    { "path": ".github/copilot-instructions.md", "kind": "copilot" },
    { "path": ".cursor/rules/lead-flow-agents.mdc", "kind": "cursor" },
    { "path": "CLAUDE.md", "kind": "claude" },
    { "path": "AGENTS.md", "kind": "codex" }
  ]
}
```

Kinds suportados: `"copilot"`, `"cursor"`, `"claude"`, `"codex"`, `"github"`.

---

## Regras críticas (MUST)

- **Nunca** editar adapters gerados (`CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `.cursor/rules/lead-flow-agents.mdc`, `.cursor/skills/*.mdc`, `.github/prompts/*.prompt.md`).
- **Sempre** rodar `bun run governance:check` antes de commitar qualquer mudança em `agents.md`.
- **Sempre** rodar `bun run governance:sync` após editar `agents.md`.
- **Sempre** rodar `bun run skills:sync` após editar `.claude/skills/*.md`.
- Uma mudança de governança **não está completa** até todos os adapters refletirem a mesma regra.
- Skills que usam `manus-mcp-cli` **devem** incluir nota de compatibilidade de ambiente.

## Anti-padrões (MUST NOT)

- Editar `CLAUDE.md`, `AGENTS.md` ou qualquer adapter diretamente.
- Criar skills em `.cursor/skills/` ou `.github/prompts/` manualmente.
- Commitar com `bun run governance:check` falhando.
- Remover adapters do `ai-governance.config.json` sem autorização do owner.
