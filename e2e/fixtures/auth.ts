import {
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

export async function injectE2eAuthCookie(
  context: CookieInjectableContext,
  options?: { token?: string; baseUrl?: string },
): Promise<void> {
  const baseUrl = options?.baseUrl ?? resolveE2eBaseUrl();
  const token = options?.token ?? signE2eSessionToken();
  await context.addCookies([
    {
      name: E2E_COOKIE_NAME,
      value: token,
      url: baseUrl,
      path: "/",
      httpOnly: true,
      secure: baseUrl.startsWith("https://"),
      sameSite: "Lax",
    },
  ]);
}

export const E2E_AUTH_USER = {
  id: E2E_MASTER_SUPABASE_ID,
  email: E2E_MASTER_EMAIL,
  supabaseId: E2E_MASTER_SUPABASE_ID,
} as const;
