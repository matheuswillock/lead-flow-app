"use server"

import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"

export const createSupabaseServer = async () => {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[supabase] Variáveis NEXT_PUBLIC_SUPABASE_URL / ANON_KEY ausentes.')
    }
    return null
  }
  
  return createServerClient(
    url,
    anon,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options })
        },
      },
    }
  )
}
