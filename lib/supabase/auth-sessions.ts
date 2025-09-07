import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next()
  const isDev = process.env.NODE_ENV === "development"

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Persist cookies on the response (required in Next middleware)
            response.cookies.set({ name, value, ...options })
          })
        },
      },
    },
  );

  if (isDev) console.info("[middleware] Fetching user from Supabase")
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError && isDev) console.error("[middleware] Error fetching user:", userError)

  if (user && isDev) console.info("[middleware] User found:", { id: user.id, email: user.email })
  if (!user && isDev) console.info("[middleware] No user found")

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