# Runbook local do Playwright

Leia este runbook somente para executar ou diagnosticar E2E local.

1. Se `.env.test` não existir, copie de `.env.test.example`. O Playwright carrega esse arquivo sem sobrescrever variáveis já exportadas.
2. `bun run test:e2e:local` reutiliza um servidor e não inicia o Next. Exporte o mesmo ambiente no processo do servidor:

```bash
set -a; source .env.test; set +a
bun run dev
```

Em outro terminal:

```bash
bun run test:e2e:local -- e2e/specs/<arquivo>.spec.ts
```

3. A autenticação E2E entra por cookie assinado. `injectE2eAuthCookie` recebe o `context`, não a `page`.
4. Marque o “what's new” como visto com `context.addInitScript`; não toque `localStorage` em `about:blank`. Obtenha a versão do componente, sem fixá-la no teste.
5. Espere um seletor, resposta ou contador; compilação sob demanda torna sleeps fixos instáveis.
6. Se a UI estiver vazia, compare com a API pela própria página antes de atribuir o problema ao render.
7. Para execução sem servidor reutilizado, faça build antes de `bun run test:e2e`.

Se o navegador conectado não aparecer no Linux, confirme remote debugging e evite instalações Snap/Flatpak incompatíveis. Quando não puder reiniciar a sessão do owner, use uma instância separada com `--remote-debugging-port` e `--user-data-dir` próprios.
