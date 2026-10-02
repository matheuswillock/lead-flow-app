import { E2E_CLIENT_SESSION_COOKIE_NAME } from "./constants";

export type E2eClientSessionUser = {
  id: string;
  email: string;
};

/**
 * Lê `sb-e2e-auth-user` (cookie não httpOnly, sem segredo) via
 * `document.cookie`. Só chamado quando `isE2eTestModeClient()` é true —
 * ver AuthContext.tsx. Nunca decodifica o JWT real (`sb-e2e-auth-token`,
 * httpOnly, verificado só no servidor com E2E_JWT_SECRET).
 */
export function readE2eClientSessionCookie(): E2eClientSessionUser | null {
  if (typeof document === "undefined") return null;

  const prefix = `${E2E_CLIENT_SESSION_COOKIE_NAME}=`;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(prefix));
  if (!match) return null;

  try {
    const raw = decodeURIComponent(match.slice(prefix.length));
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as { id?: unknown }).id === "string" &&
      typeof (parsed as { email?: unknown }).email === "string"
    ) {
      return { id: (parsed as { id: string }).id, email: (parsed as { email: string }).email };
    }
    return null;
  } catch {
    return null;
  }
}
