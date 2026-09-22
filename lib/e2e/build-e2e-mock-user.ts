import type { User } from "@supabase/supabase-js";
import type { E2eClientSessionUser } from "./read-e2e-client-session-cookie";

/**
 * Constrói um `User` do supabase-js minimamente válido a partir do cookie
 * client-side de sessão E2E. Nunca é uma sessão Supabase real — só existe
 * para popular `useAuth().user` em specs Playwright (ver AuthContext.tsx),
 * já que `injectE2eAuthCookie` não autentica o client do Supabase no
 * browser (esse client aponta pro projeto remoto; a suíte E2E não usa
 * Auth/Storage remotos — ver E2E_JWT_SECRET/resolveE2eUser no servidor).
 */
export function buildE2eMockUser(sessionUser: E2eClientSessionUser): User {
  const nowIso = new Date(0).toISOString();
  return {
    id: sessionUser.id,
    email: sessionUser.email,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: nowIso,
  };
}
