# Testes e verificação

Leia este arquivo para criar testes, alterar UI ou preparar a validação final.

## Ciclo

- Testes críticos devem exercitar código real e provar que sabem falhar por controle negativo temporário.
- Página, rota ou fluxo novo recebe spec antes da implementação; a spec começa vermelha, fica verde e então o código é refatorado.
- Todo script criado para execução operacional deve ser testável: separe a entrada/CLI e os efeitos externos da lógica de negócio, injete dependências explícitas e cubra automaticamente os caminhos relevantes de sucesso e falha.
- Specs de página ficam em `e2e/specs/<domínio>/<slug>.spec.ts` e chamam `runResponsiveChecks`; specs somente de API terminam em `-api.spec.ts`.
- Não aumente allowlists. Ao corrigir uma exceção existente, remova sua entrada na mesma mudança.
- Espere condições observáveis, nunca sleeps fixos.

## Validação durante o trabalho

Após um conjunto coerente de alterações, execute typecheck/lint direcionado e os testes do comportamento alterado. Não rode a bateria completa depois de cada edição isolada.

Antes da entrega, execute a sequência universal de `agents.md`. Para UI, acrescente:

```bash
bun run design:check
bun run build
bun run test:e2e
```

Use a spec relevante localmente quando a suíte completa não for necessária durante a iteração.

## Visual

- Observe a tela renderizada por Playwright, preview/dev server, navegador conectado ou screenshot do owner.
- Confirme ausência de erro no console, conteúdo no viewport e `scrollWidth <= innerWidth + 1` em 360px.
- Meça contraste, dimensões, overflow e texto pelo DOM; não use apenas julgamento do screenshot.
- `design:check`, lint e leitura estática não substituem essa verificação.
- Se nenhum método estiver disponível, declare “não verificado visualmente — apenas leitura estática” e não marque o trabalho visual como concluído.

## Confiabilidade

- Capture o exit code antes de filtrar output; pipelines com `head` podem mascarar OOM ou falha.
- Neutralize variáveis de ambiente nos testes com mocks quando não forem parte do comportamento.
- Para setup local do Playwright e autenticação E2E, leia `.governance/ai/playwright-runbook.md` somente quando necessário.

## Correção de bug (regressão obrigatória)

1. Escreva a spec de regressão antes do fix e rode-a contra o código sem correção: ela precisa falhar pelo motivo do bug (use `git stash` apenas dos arquivos de produção).
2. Reproduza o cenário no app renderizado com `browser-harness` e registre o sinal de falha (estado do DOM, URL, rede).
3. Aplique o fix; a mesma spec e o mesmo cenário no `browser-harness` ficam verdes. Em bug de UI, rode também a auditoria `impeccable`.
4. Rode Playwright com `node node_modules/@playwright/test/cli.js` (sob Bun a spec pode falhar ao compilar) e aponte `E2E_BASE_URL` para um `next dev` da árvore atual; confira com `ps` que o servidor da porta não é um `next start` antigo.
5. Server action com `redirect()`: no cliente ela chega como exceção `NEXT_REDIRECT`; não trate como falha nem reabilite o formulário. Mocke a action em E2E com `x-action-redirect` e corpo `0:{"a":"$@1","f":"","b":"e2e"}\n1:null`.
