/** Constantes compartilhadas entre seed E2E, JWT de sessão e fixtures Playwright. */

export const E2E_MASTER_SUPABASE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
export const E2E_MASTER_EMAIL = "e2e.master@example.com";
export const E2E_MASTER_FULL_NAME = "E2E Master";
export const E2E_COOKIE_NAME = "sb-e2e-auth-token";
export const E2E_TEAM_NAME = "E2E Time";

/**
 * Cookie NÃO httpOnly, lido pelo client (AuthContext) só quando
 * NEXT_PUBLIC_E2E_TEST_MODE=true. Carrega apenas {id, email} — nunca um
 * segredo — para popular `useAuth().user` em specs Playwright, já que
 * `sb-e2e-auth-token` (verificado no servidor via E2E_JWT_SECRET) é
 * httpOnly por design e não pode ser lido por JS de página.
 */
export const E2E_CLIENT_SESSION_COOKIE_NAME = "sb-e2e-auth-user";
