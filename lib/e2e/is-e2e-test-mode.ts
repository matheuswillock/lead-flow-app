/**
 * Gate do bypass de sessão E2E.
 *
 * Ativo somente com E2E_TEST_MODE=true e APP_ENV=test.
 * Recusa deploy de produção (VERCEL_ENV=production).
 *
 * `next start` define NODE_ENV=production — isso NÃO desliga o bypass,
 * senão o job Playwright no CI nunca autenticaria.
 */
export function isE2eTestMode(): boolean {
  if (process.env.VERCEL_ENV === "production") return false;
  return process.env.E2E_TEST_MODE === "true" && process.env.APP_ENV === "test";
}
