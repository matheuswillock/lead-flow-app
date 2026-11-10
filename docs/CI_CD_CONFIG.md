# CI/CD e Vercel CI

O repositório mantém GitHub Actions para deploys, migrations, E2E e demais etapas que precisam de serviços ou credenciais. O Vercel CI adiciona execução seletiva dos checks definidos no Turborepo; ele não substitui esses workflows.

## Configuração do Turborepo

O projeto é single-package e usa Turborepo `2.11.10` (`turbo.json` na raiz). O Vercel CI requer Turborepo `2.11.7` ou superior. As tarefas são declaradas em `turbo.json`; somente tarefas com a tag `ci` entram no Vercel CI, respeitando o grafo de dependências e o cache do Turbo.

Atualmente estão marcadas:

- `lint`, `typecheck`, `test` e `test:proxy`;
- `governance:check`, `governance:check-api-masking`, `governance:check-e2e-pages` e `governance:check-responsive`;
- `design:check`, `lint:pt-br` e `build`.

As tags `ci:cpus:<n>` definem a capacidade das tarefas mais pesadas. Tarefas de integração, E2E, migrations, deploy e processos persistentes ficam fora dessa lista porque dependem de serviços, credenciais ou não terminam.

## Variáveis de ambiente

`vercel.json` declara constantes não secretas para o Vercel CI. O build recebe placeholders para Supabase, Resend e banco, seguindo os fallbacks do job `Build (quality gate)` em `.github/workflows/ci-main.yml`. `turbo.json` permite ao build receber essas variáveis e os valores `DATABASE_URL`/`DIRECT_URL`.

Os placeholders existem apenas para validação de build e não devem ser usados em deploy ou conectados a dados reais. Não grave secrets no `vercel.json`; adicione valores sensíveis nas variáveis de ambiente de CI da Vercel.

## Execução local

Para conferir o plano sem executar as tarefas:

```bash
bun run turbo run lint typecheck test test:proxy governance:check governance:check-api-masking governance:check-e2e-pages governance:check-responsive design:check lint:pt-br build --dry
```

Para executar uma tarefa localmente, remova `--dry` e selecione apenas a tarefa desejada, por exemplo `bun run turbo run typecheck`.

Os comandos diretos `bun run ...` continuam válidos para a validação local prevista em `agents.md`; Turborepo é a orquestração seletiva usada pelo Vercel CI.

## Habilitação no Vercel

O arquivo `turbo.json` configura as tarefas, mas não habilita o Vercel CI na conta. O repositório precisa ser privado, estar acessível ao GitHub App da Vercel e pertencer a apenas um time Vercel. Use o CLI Vercel `64.3.1` ou mais recente e habilite o CI antes do primeiro push da branch de configuração:

```bash
vercel ci enable --remote <remote> --scope <team>
```

Depois do primeiro push, o Vercel CI cria a execução e publica o resultado como check no GitHub. As execuções posteriores começam em cada `git push`, mas rodam apenas as tarefas marcadas e afetadas pelas mudanças.
