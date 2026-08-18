import { E2E_COOKIE_NAME } from "@/lib/e2e/constants";
import { verifyE2eJwt } from "@/lib/e2e/e2e-jwt-verify";
import { isE2eTestMode } from "@/lib/e2e/is-e2e-test-mode";

export type E2eSessionUser = {
  id: string;
  email: string;
  supabaseId: string;
};

export async function resolveE2eUserFromCookie(
  cookieValue: string | undefined | null,
): Promise<E2eSessionUser | null> {
  if (!isE2eTestMode()) return null;
  if (!cookieValue) return null;

  const claims = await verifyE2eJwt(cookieValue);
  if (!claims) {
    console.error("[E2E] Cookie de sessão E2E inválido");
    return null;
  }

  return {
    id: claims.sub,
    email: claims.email,
    supabaseId: claims.sub,
  };
}

export async function resolveE2eUser(
  getCookieValue: (name: string) => string | undefined | null,
): Promise<E2eSessionUser | null> {
  return resolveE2eUserFromCookie(getCookieValue(E2E_COOKIE_NAME));
}
