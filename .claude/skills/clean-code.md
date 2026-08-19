---
description: Checklist obrigatório de Clean Code e SOLID do Corretor Studio. Usar SEMPRE antes de brainstorming técnico, planejamento de implementação, ou escrita de código (frontend ou backend) — nomear variável/função/classe, desenhar UseCase/Service/Repository/Context, refatorar, extrair função, reduzir complexidade, aplicar responsabilidade única (SRP), open/closed (OCP), substituição de Liskov (LSP), segregação de interface (ISP), inversão de dependência (DIP), DRY sem over-engineering.
---

Aplique Clean Code e SOLID (adaptado de [clean-code-javascript](https://github.com/felipe-augusto/clean-code-javascript) para TypeScript + Next.js + Prisma deste repositório) em toda proposta técnica — inclusive brainstorming e planejamento, não só código já escrito.

## Quando este skill se aplica

- Antes de propor um plano de implementação (mesmo em texto, sem código ainda).
- Antes de nomear uma variável, função, classe, UseCase, Service, Repository ou Context nova.
- Antes de escrever ou revisar qualquer função (frontend ou backend).
- Ao refatorar código existente.

## Nomes significativos

- Nomes pronunciáveis e buscáveis; sem abreviações obscuras (`lp` para `leadProfile`).
- Nome de UseCase/Service/Repository descreve a intenção de negócio, não a implementação (`FinalizeLeadUseCase`, não `ProcessUseCase2`).
- Uma palavra por conceito — não misturar `get`/`fetch`/`retrieve` para a mesma operação no mesmo módulo.
- Booleans com prefixo de pergunta: `isValid`, `hasAccess`, `canEdit`.

## Funções pequenas, uma responsabilidade

- Uma função faz uma coisa, em um nível de abstração.
- Poucos argumentos — a partir de 3, agrupar em um objeto de opções tipado.
- Evitar parâmetro booleano de flag que muda o comportamento da função (`save(lead, true)`); preferir duas funções ou um objeto explícito (`{ silent: true }`).
- Evitar efeitos colaterais escondidos — se a função lê nome de "get"/"is", ela não deve mutar estado.
- `Route -> UseCase -> [Service] -> Repository/Prisma` é uma cadeia de funções pequenas e coesas: Route só parseia request/mapeia status; UseCase só orquestra regra de negócio; Service só concentra lógica de domínio complexa.

## SOLID aplicado à arquitetura do projeto

- **SRP** — 1 UseCase cobre 1 caso de uso de negócio. Service não faz parsing HTTP. Route não contém regra de negócio.
- **OCP** — ao adicionar uma variação (novo canal de campanha, novo tipo de status), preferir composição/estratégia a um `if/else`/`switch` gigante que cresce a cada caso novo.
- **LSP** — qualquer implementação concreta de uma interface de Service/Repository deve ser substituível pela interface sem quebrar o consumidor (sem checar o tipo concreto por fora).
- **ISP** — interfaces de serviço enxutas (interface + implementação concreta, já é MUST do projeto); não forçar quem consome a depender de métodos que não usa.
- **DIP** — UseCase depende de uma interface de Service/Repository, nunca do Prisma direto (reforça a regra já existente "Routes MUST NOT call Prisma directly" — o mesmo vale para UseCases sem Service; ver `governance:check` / `validateNoPrismaInUseCase`).

## DRY sem over-engineering

- Duplicação de 2-3 linhas simples não justifica abstração nova — três linhas parecidas é melhor que uma abstração prematura.
- Não crie helper/wrapper genérico para um único caso de uso hipotético futuro.
- Isso não contradiz Clean Code: DRY é sobre eliminar duplicação de **conhecimento/regra de negócio**, não sobre eliminar toda repetição textual.

## Tratamento de erros

- UseCases retornam `Output` (`lib/output/index.ts`) — nunca engolir exceções silenciosamente.
- Mensagens de erro descritivas, nunca genéricas (`"Erro"` sozinho).
- `console.error` para erros, `console.info` para logs de fluxo, com nome de rota estável (`[NomeRoute][METHOD]`).

## Comentários

- Só quando o "porquê" não é óbvio pelo código (constraint escondida, workaround de bug específico, invariante não trivial).
- Nunca comentar o "o quê" — nomes bem escolhidos já dizem isso.

## Tocar em arquivo listado em exceção legada (MUST refatorar)

Se a mudança vai tocar em um arquivo listado em `dipPrismaInUseCaseAllowlist`
(ou outra allowlist relacionada a Clean Code/SOLID em
`.governance/ai-governance.config.json`), isso **MUST** ser identificado já no
brainstorming/planejamento — antes de escrever qualquer código — e declarado
explicitamente no plano apresentado.

- Verificar a allowlist relevante em `.governance/ai-governance.config.json`
  antes de propor o plano; se o arquivo alvo está listado, o plano **MUST**
  incluir a refatoração da violação (ex.: extrair acesso a Prisma para um
  Service/Repository) como parte do mesmo escopo — não como item futuro.
- Não é opcional "se der tempo": tocar no arquivo é o gatilho. Refatorar
  **imediatamente**, na mesma mudança, e remover a entrada da allowlist em
  `.governance/ai-governance.config.json` (mesma regra geral já existente em
  `agents.md` § LEGACY EXCEPTIONS, agora aplicada de forma obrigatória e não
  apenas "quando o refactor por acaso remover a exceção").
- Se o escopo pedido pelo usuário for estritamente incompatível com esse
  refactor (ex.: hotfix urgente sob prazo), a exceção **MUST** ser levantada
  explicitamente para o usuário decidir — nunca ignorada silenciosamente.

## Antes de finalizar (MUST)

Para planejamento/brainstorm: revisar a proposta contra este checklist (nomes, SRP, tamanho de função, SOLID) antes de apresentá-la.

Para implementação: além do checklist acima, rodar a sequência de validação já mandatória do projeto:

```bash
bun run typecheck 2>&1 | head -20
bun run lint
bun run governance:check
```

## Checklist de conformidade

- [ ] Nomes de variáveis/funções/classes são autoexplicativos e sem abreviação obscura?
- [ ] Cada função faz uma coisa só, em um nível de abstração?
- [ ] Função tem poucos parâmetros (objeto de opções a partir de 3)?
- [ ] Nenhum parâmetro booleano de flag mudando comportamento?
- [ ] UseCase não chama Prisma direto (passa por Service/Repository)?
- [ ] Nova variação usa composição/estratégia em vez de `if/else`/`switch` crescente (OCP)?
- [ ] Interface de Service/Repository é enxuta e tem implementação concreta (ISP)?
- [ ] Duplicação eliminada é de regra de negócio, não abstração prematura sobre poucas linhas (DRY sem over-engineering)?
- [ ] Erros tratados via `Output`/mensagens descritivas, nunca engolidos?
- [ ] Comentários existentes só explicam o "porquê", nunca o "o quê"?

## Anti-padrões (MUST NOT)

- Função com múltiplos níveis de abstração misturados (parsing + regra de negócio + I/O na mesma função).
- Classe/módulo "God object" acumulando responsabilidades não relacionadas.
- Parâmetro booleano de flag (`function save(data, isDraft)`).
- UseCase chamando `prisma.*`/`$queryRaw`/`$executeRaw` direto, pulando Service/Repository.
- Abstração genérica criada para um único caso de uso hipotético.
- Comentário que só repete o nome da função/variável em português.
