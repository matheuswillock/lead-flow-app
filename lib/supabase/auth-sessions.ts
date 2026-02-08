import { NextResponse, type NextRequest } from "next/server";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return { url, anon };
}

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some(({ name }) =>
    name === "sb-access-token" ||
    name === "sb-refresh-token" ||
    name.includes("-auth-token")
  );
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

  let user = null;
  let userError: Error | null = null;

  if (hasSupabaseAuthCookie(request)) {
    const { data, error } = await supabase.auth.getUser();
    user = data.user ?? null;
    userError = error ?? null;
  }

  if (userError && userError.name !== "AuthSessionMissingError" && isDev) {
    console.error("[middleware] Error fetching user:", userError)
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
