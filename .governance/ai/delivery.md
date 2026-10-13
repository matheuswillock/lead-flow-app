# Git e entrega

Leia este arquivo somente para criar branch, commit, push, PR ou resolver conflitos.

## Branches

- Antes de iniciar `feature/*` ou `bugfix/*`, atualize a base a partir de `origin/develop`.
- Nunca faça commit ou push direto em `main`, `develop` ou `release/*`.
- Branches `release/*` são controladas pela CI.

## Push seguro

No primeiro push, publique a branch normalmente. Em pushes seguintes:

```bash
git fetch origin <branch>
git merge origin/<branch>
git fetch origin develop
git merge origin/develop
git push origin <branch>
```

- Não use `git pull` quando ele puder rebasear commits já publicados.
- Nunca use `--force`, `--force-with-lease` ou `-f` sem autorização inequívoca do owner.
- Resolva conflitos hunk por hunk; não aplique `--ours`/`--theirs` em massa.
- Se apenas force-push resolver a divergência, pare e peça direção.

## Pull requests

- Não crie PR manualmente. A CI cria/atualiza PRs de feature/bugfix para `develop`, de `develop` para `main` e de sincronização de `main` para `develop`.
- Depois do push, verifique o PR criado pela pipeline.
- Correções de review em PR `develop -> main` entram por nova branch feature/bugfix para `develop`; nunca altere `release/*` diretamente.

## Commits

- Não crie documentos de resumo de implementação. Use commit descritivo e resposta final curta.
- Preserve mudanças locais alheias ao escopo e não sobrescreva arquivos modificados por outra pessoa/sessão.
