/**
 * Gate do bypass de sessão E2E no bundle do BROWSER.
 *
 * Espelha `isE2eTestMode()` (lib/e2e/is-e2e-test-mode.ts), mas esta roda no
 * client — só variáveis `NEXT_PUBLIC_*` são inlined no bundle. Não dá para
 * ler APP_ENV/VERCEL_ENV aqui (não são expostas ao browser); a Vercel expõe
 * o equivalente público automaticamente como NEXT_PUBLIC_VERCEL_ENV, usado
 * como a mesma recusa de produção do gate server-side.
 *
 * Efeito: quando true, AuthContext lê `sb-e2e-auth-user` (cookie não
 * httpOnly, sem segredo) em vez de chamar supabase.auth.getSession() — ver
 * `readE2eClientSessionCookie()`.
 */
export function isE2eTestModeClient(): boolean {
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === "production") return false;
  return process.env.NEXT_PUBLIC_E2E_TEST_MODE === "true";
}
