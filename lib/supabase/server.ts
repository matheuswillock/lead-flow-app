import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

export const createSupabaseServer = async () => {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
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

/**
 * Cria um cliente Supabase com Service Role Key para operações administrativas
 * Use apenas no servidor para criar/deletar usuários, etc.
 *
 * Segurança (stack local híbrido): nesse modo, NEXT_PUBLIC_SUPABASE_URL aponta
 * para o proxy local (docker-compose.local.yml), mas Auth/Storage por trás dele
 * são o projeto Supabase REMOTO — não há sandbox local. Ações admin
 * (auth.admin.deleteUser/updateUserById, upload/delete no Storage) mutariam
 * dados REAIS do projeto remoto. Por padrão isso é bloqueado; defina
 * SUPABASE_LOCAL_ALLOW_REMOTE_ADMIN=true em docker/local/.env.local-stack para
 * habilitar (recomendado apenas com um projeto Supabase de desenvolvimento
 * isolado, nunca o de produção).
 *
 * IMPORTANTE: a detecção usa o marcador explícito SUPABASE_HYBRID_LOCAL_STACK
 * (setado por scripts/dev-local.ts apenas no modo híbrido), não a URL — o
 * modo --full-supabase também expõe Auth/Storage em 127.0.0.1 (stack local de
 * verdade, sem proxy para o remoto), e não deve ser bloqueado.
 */
export const createSupabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !serviceRoleKey) {
    return null
  }

  const isHybridLocalStack = process.env.SUPABASE_HYBRID_LOCAL_STACK === "true"
  if (isHybridLocalStack && process.env.SUPABASE_LOCAL_ALLOW_REMOTE_ADMIN !== "true") {
    console.error(
      "[createSupabaseAdmin] Bloqueado: stack local híbrido ativo (SUPABASE_HYBRID_LOCAL_STACK=true) — " +
        "NEXT_PUBLIC_SUPABASE_URL é o proxy local, mas a service role key é do projeto Supabase REMOTO. " +
        "Ações admin (criar/deletar usuário, upload/delete de arquivo) mutariam dados reais do projeto remoto. " +
        "Defina SUPABASE_LOCAL_ALLOW_REMOTE_ADMIN=true em docker/local/.env.local-stack para permitir " +
        "(use um projeto Supabase de desenvolvimento isolado, nunca produção)."
    )
    return null
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
