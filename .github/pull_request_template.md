## Context

- Summary of changes:
- Why this change is needed:

## Validation

- [ ] `bun run governance:sync`
- [ ] `bun run governance:check`
- [ ] `bun run governance:check-api-masking`
- [ ] `bun run typecheck`
- [ ] `bun run lint`

## Governance Checklist (required)

- [ ] Seguiu `agents.md`?
- [ ] Fez pull da `develop` antes de iniciar a branch de trabalho?
- [ ] Confirmou que nenhum PR foi criado manualmente e que nenhum commit foi feito direto em `main`/`develop`/`release/*`?
- [ ] Criou excecao legada? Se sim, justificou e atualizou `.governance/ai-governance.config.json`?
- [ ] Nao adicionou JS/Python para nova feature; se adicionou, registrou exception?
- [ ] Manteve adapters sincronizados (`bun run governance:sync`)?
- [ ] Confirmou sincronizacao do `AGENTS.md` gerado para Codex?

## Additional Notes

- Risks:
- Rollback plan:
