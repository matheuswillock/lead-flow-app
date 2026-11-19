import {
  E2E_CLIENT_SESSION_COOKIE_NAME,
  E2E_COOKIE_NAME,
  E2E_MASTER_EMAIL,
  E2E_MASTER_SUPABASE_ID,
} from "../support/e2e-ids";
import { signE2eJwt } from "../../lib/e2e/e2e-jwt";

type PlaywrightCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None";
};

type PlaywrightStorageState = {
  cookies: PlaywrightCookie[];
  origins: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
};

type CookieInjectableContext = {
  addCookies: (
    cookies: Array<{
      name: string;
      value: string;
      url?: string;
      domain?: string;
      path?: string;
      expires?: number;
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: "Strict" | "Lax" | "None";
    }>,
  ) => Promise<void>;
};

function resolveE2eBaseUrl(): string {
  return (
    process.env.E2E_BASE_URL?.trim() ||
    process.env.PLAYWRIGHT_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://127.0.0.1:3000"
  );
}

function hostnameFromBaseUrl(baseUrl: string): string {
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return "127.0.0.1";
  }
}

export function signE2eSessionToken(): string {
  return signE2eJwt();
}

export function buildE2eAuthCookie(
  token: string = signE2eSessionToken(),
  baseUrl: string = resolveE2eBaseUrl(),
): PlaywrightCookie {
  return {
    name: E2E_COOKIE_NAME,
    value: token,
    domain: hostnameFromBaseUrl(baseUrl),
    path: "/",
    expires: -1,
    httpOnly: true,
    secure: baseUrl.startsWith("https://"),
    sameSite: "Lax",
  };
}

export function buildE2eStorageState(
  baseUrl: string = resolveE2eBaseUrl(),
): PlaywrightStorageState {
  return {
    cookies: [buildE2eAuthCookie(signE2eSessionToken(), baseUrl)],
    origins: [],
  };
}

export function buildE2eAddCookiesPayload(
  token: string = signE2eSessionToken(),
  baseUrl: string = resolveE2eBaseUrl(),
): {
  name: string;
  value: string;
  url: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Lax";
} {
  const url = new URL("/", baseUrl).href;
  return {
    name: E2E_COOKIE_NAME,
    value: token,
    url,
    httpOnly: true,
    secure: url.startsWith("https://"),
    sameSite: "Lax",
  };
}

/**
 * Cookie NÃO httpOnly com só {id, email} — nunca um segredo. Lido pelo
 * client (AuthContext, via readE2eClientSessionCookie) quando
 * NEXT_PUBLIC_E2E_TEST_MODE=true, para popular `useAuth().user` em specs
 * Playwright. `sb-e2e-auth-token` (o JWT assinado) fica httpOnly de
 * propósito e não pode ser lido por JS de página — ver
 * lib/e2e/is-e2e-test-mode-client.ts.
 */
export function buildE2eClientSessionCookiePayload(
  supabaseId: string = E2E_MASTER_SUPABASE_ID,
  email: string = E2E_MASTER_EMAIL,
  baseUrl: string = resolveE2eBaseUrl(),
): {
  name: string;
  value: string;
  url: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Lax";
} {
  const url = new URL("/", baseUrl).href;
  return {
    name: E2E_CLIENT_SESSION_COOKIE_NAME,
    value: encodeURIComponent(JSON.stringify({ id: supabaseId, email })),
    url,
    httpOnly: false,
    secure: url.startsWith("https://"),
    sameSite: "Lax",
  };
}

export async function injectE2eAuthCookie(
  context: CookieInjectableContext,
  options?: {
    token?: string;
    baseUrl?: string;
    /** Assina o JWT para outro usuário (ex.: backoffice). Default: master seedado. */
    supabaseId?: string;
    email?: string;
  },
): Promise<void> {
  const baseUrl = options?.baseUrl ?? resolveE2eBaseUrl();
  const supabaseId = options?.supabaseId ?? E2E_MASTER_SUPABASE_ID;
  const email = options?.email ?? E2E_MASTER_EMAIL;
  const token =
    options?.token ??
    (options?.supabaseId || options?.email
      ? signE2eJwt({ supabaseId: options.supabaseId, email: options.email })
      : signE2eSessionToken());
  await context.addCookies([
    buildE2eAddCookiesPayload(token, baseUrl),
    buildE2eClientSessionCookiePayload(supabaseId, email, baseUrl),
  ]);
}

export const E2E_AUTH_USER = {
  id: E2E_MASTER_SUPABASE_ID,
  email: E2E_MASTER_EMAIL,
  supabaseId: E2E_MASTER_SUPABASE_ID,
} as const;
