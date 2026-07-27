import { NextResponse, type NextRequest } from "next/server";
import { isAuthSessionExpired } from "@/lib/auth/session-lifetime";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return { url, anon };
}

function cookiesIncludeSupabaseAuth(cookies: { name: string }[]) {
  return cookies.some(({ name }) =>
    name === "sb-access-token" ||
    name === "sb-refresh-token" ||
    name.includes("-auth-token")
  );
}

function hasSupabaseAuthCookie(request: NextRequest) {
  return cookiesIncludeSupabaseAuth(request.cookies.getAll());
}

function hasSupabaseAuthCookieOnResponse(response: NextResponse) {
  return cookiesIncludeSupabaseAuth(response.cookies.getAll());
}

export function copySessionCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
}

export function redirectWithSession(
  sessionResponse: NextResponse,
  url: URL | string,
): NextResponse {
  const redirectResponse = NextResponse.redirect(url);
  copySessionCookies(sessionResponse, redirectResponse);
  return redirectResponse;
}

export function nextWithSession(
  sessionResponse: NextResponse,
  init?: Parameters<typeof NextResponse.next>[0],
): NextResponse {
  const nextResponse = NextResponse.next(init);
  copySessionCookies(sessionResponse, nextResponse);
  return nextResponse;
}

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next()
  const isDev = process.env.NODE_ENV === "development"

  const env = getSupabaseEnv();
  if (!env) {
    return { supabase: null, response, user: null };
  }

  // Dynamic import to avoid Edge Runtime issues
  const { createServerClient } = await import("@supabase/ssr");

  const supabase = createServerClient(
    env.url,
    env.anon,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({ name, value, ...options })
          })
        },
      },
    },
  );

  const authCode = request.nextUrl.searchParams.get("code");
  if (authCode) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode);
    const callbackUrl = request.nextUrl.clone();

    if (!exchangeError) {
      callbackUrl.searchParams.delete("code");
      if (callbackUrl.pathname !== "/auth/callback") {
        callbackUrl.pathname = "/auth/callback";
        if (!callbackUrl.searchParams.has("next")) {
          callbackUrl.searchParams.set("next", "/crm");
        }
        const redirectResponse = NextResponse.redirect(callbackUrl);
        copySessionCookies(response, redirectResponse);
        return {
          supabase,
          response: redirectResponse,
          user: null,
        };
      }
      if (request.nextUrl.searchParams.has("code")) {
        const redirectResponse = NextResponse.redirect(callbackUrl);
        copySessionCookies(response, redirectResponse);
        return {
          supabase,
          response: redirectResponse,
          user: null,
        };
      }
    } else if (callbackUrl.pathname !== "/auth/callback") {
      callbackUrl.pathname = "/auth/callback";
      if (!callbackUrl.searchParams.has("next")) {
        callbackUrl.searchParams.set("next", "/crm");
      }
      const redirectResponse = NextResponse.redirect(callbackUrl);
      copySessionCookies(response, redirectResponse);
      return {
        supabase,
        response: redirectResponse,
        user: null,
      };
    } else if (exchangeError && isDev) {
      console.error("[proxy] exchangeCodeForSession:", exchangeError.message);
    }
  }

  let user = null;
  let userError: Error | null = null;

  if (hasSupabaseAuthCookie(request) || hasSupabaseAuthCookieOnResponse(response)) {
    const { data, error } = await supabase.auth.getUser();
    user = data.user ?? null;
    userError = error ?? null;
  }

  if (user && isAuthSessionExpired(user.last_sign_in_at)) {
    console.info("[proxy] Auth session expired (max 6h) — signing out", {
      userId: user.id,
      lastSignInAt: user.last_sign_in_at,
    })
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError && isDev) {
      console.error("[proxy] signOut after session expiry:", signOutError.message)
    }
    user = null
  }

  if (userError && userError.name !== "AuthSessionMissingError" && isDev) {
    console.error("[proxy] Error fetching user:", userError)
  }

  return {
    supabase,
    response,
    user: user
      ? {
          ...user,
          supabaseId: user.id,
        }
      : null,
  }
}
