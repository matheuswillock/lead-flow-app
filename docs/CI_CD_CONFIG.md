# CI/CD e Vercel CI

O repositório mantém GitHub Actions para deploys, migrations, E2E e demais etapas que precisam de serviços ou credenciais. O Vercel CI adiciona execução seletiva dos checks definidos no Turborepo; ele não substitui esses workflows.

## Configuração do Turborepo

O projeto é single-package e usa Turborepo `2.11.10` (`turbo.json` na raiz). O Vercel CI requer Turborepo `2.11.7` ou superior. As tarefas são declaradas em `turbo.json`; somente tarefas com a tag `ci` entram no Vercel CI, respeitando o grafo de dependências e o cache do Turbo.

Atualmente estão marcadas:

- `lint`, `typecheck`, `test` e `test:proxy`;
- `governance:check`, `governance:check-api-masking`, `governance:check-e2e-pages` e `governance:check-responsive`;
- `design:check`, `lint:pt-br`, `build:ci` e `e2e:ci`.

`build:ci` roda `bun run build` e em seguida `bun run build:verify` ([scripts/validate-build-output.ts](../scripts/validate-build-output.ts)), que reprova um build com exit code zero mas saída incompleta (`.next/BUILD_ID` ausente ou vazio, `.next/server` ou `.next/required-server-files.json` ausentes). A validação roda na mesma tarefa do build para não depender de transferir `.next` entre instâncias do Vercel CI. É o equivalente da action `validate-build-output` (modo `next`) do GitHub Actions; o modo `vercel` (`.vercel/output`) continua só nos workflows de deploy.

O antigo passo `governance:sync` + `git diff --exit-code` do CI Light não tem tarefa própria: `governance:check` já compara cada adaptador com o conteúdo esperado e falha com `Adapter out of sync`.

`e2e:ci` ([scripts/ci-e2e.ts](../scripts/ci-e2e.ts)) espelha a action `run-e2e-playwright`: sobe o `supabase/postgres` em Docker na porta 55322 (pull com fallback ghcr → Docker Hub), roda `db:seed:e2e`, `test:integration`, `build` e o Playwright, e remove o container no fim. Roda na imagem Ubuntu (`ci:os:ubuntu`) com 8 CPUs. A tarefa executa dentro de um container, e o diretório de dados do Docker (`/var/lib/docker`) fica em overlayfs; o kernel recusa overlay sobre overlay (`failed to mount ... fstype: overlay ... err: invalid argument`, medido em 10/11/2026 até com uma imagem de 1 camada). Por isso, antes de baixar a imagem, o script (como root) para o `dockerd`, monta um `tmpfs` de 8 GB em `/var/lib/docker` e reinicia o `dockerd`. `E2E_CI_SKIP_DOCKER_REMOUNT=1` desativa esse ajuste. A rede `bridge` do Docker 29 também não funciona ali (`Unable to enable DIRECT ACCESS FILTERING - DROP rule: iptables ... -t raw`, o kernel não tem a tabela `raw`), então o Postgres sobe com `--network host` e `PGPORT=55322`, em vez de `-p 55322:5432`. Se o container ainda não subir, o script imprime `docker info`, filesystems, mounts, processos do Docker, o log do `dockerd` reiniciado e o resultado de uma imagem de 1 camada. Diferenças em relação ao GitHub Actions: sem cache da imagem nem upload do `playwright-report` (a falha aparece nos logs, com o reporter `list`), `E2E_INCLUDE_SLOW=false` sempre e o mesmo `E2E_WORKERS` padrão (2). A chave `ASAAS_SANDBOX_API_KEY` vem de uma variável de CI da Vercel (Secret); sem ela, vale o placeholder do `.env.test.example`.

Enquanto "Vercel CI" não for check obrigatório nos rulesets, o `e2e:ci` é só espelho: o E2E do GitHub Actions continua sendo o gate, e uma falha do `e2e:ci` apenas deixa o check "Vercel CI" vermelho.

As tags `ci:cpus:<n>` definem a capacidade das tarefas mais pesadas. Migrations, deploy e processos persistentes ficam fora da lista porque dependem de credenciais de ambientes reais ou não terminam.

## Variáveis de ambiente

`vercel.json` declara constantes não secretas para o Vercel CI. O build recebe placeholders para Supabase, Resend e banco, seguindo os fallbacks do job `Build (quality gate)` em `.github/workflows/ci-main.yml`. `turbo.json` permite ao build receber essas variáveis e os valores `DATABASE_URL`/`DIRECT_URL`.

Os placeholders existem apenas para validação de build e não devem ser usados em deploy ou conectados a dados reais. Não grave secrets no `vercel.json`; adicione valores sensíveis nas variáveis de ambiente de CI da Vercel.

## Execução local

Para conferir o plano sem executar as tarefas:

```bash
bun run turbo run lint typecheck test test:proxy governance:check governance:check-api-masking governance:check-e2e-pages governance:check-responsive design:check lint:pt-br build:ci --dry
```

Para executar uma tarefa localmente, remova `--dry` e selecione apenas a tarefa desejada, por exemplo `bun run turbo run typecheck`.

Os comandos diretos `bun run ...` continuam válidos para a validação local prevista em `agents.md`; Turborepo é a orquestração seletiva usada pelo Vercel CI.

## Habilitação no Vercel

O arquivo `turbo.json` configura as tarefas, mas não habilita o Vercel CI na conta. O repositório precisa ser privado, estar acessível ao GitHub App da Vercel e pertencer a apenas um time Vercel. Use o CLI Vercel `64.3.1` ou mais recente e habilite o CI antes do primeiro push da branch de configuração:

```bash
vercel ci enable --remote <remote> --scope <team>
```

Depois do primeiro push, o Vercel CI cria a execução e publica o resultado como check no GitHub. As execuções posteriores começam em cada `git push`, mas rodam apenas as tarefas marcadas e afetadas pelas mudanças.
