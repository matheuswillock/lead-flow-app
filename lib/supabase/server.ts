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
 * Detecta o proxy local do stack híbrido (docker-compose.local.yml —
 * scripts/lib/local-stack.ts). Nesse modo, Auth/Storage são o projeto
 * Supabase REMOTO por trás do proxy — não um sandbox local.
 */
const isLocalHybridProxyUrl = (url: string): boolean => {
  try {
    const { hostname } = new URL(url)
    return hostname === "127.0.0.1" || hostname === "localhost"
  } catch {
    return false
  }
}

/**
 * Cria um cliente Supabase com Service Role Key para operações administrativas
 * Use apenas no servidor para criar/deletar usuários, etc.
 *
 * Segurança (stack local híbrido): quando NEXT_PUBLIC_SUPABASE_URL aponta para
 * o proxy local mas a service role key é a do projeto remoto, ações admin
 * (auth.admin.deleteUser/updateUserById, upload/delete no Storage) mutam
 * dados REAIS do projeto remoto — não há sandbox local para Auth/Storage.
 * Por padrão isso é bloqueado; defina SUPABASE_LOCAL_ALLOW_REMOTE_ADMIN=true
 * em docker/local/.env.local-stack para habilitar (recomendado apenas com um
 * projeto Supabase de desenvolvimento isolado, nunca o de produção).
 */
export const createSupabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !serviceRoleKey) {
    return null
  }

  if (
    isLocalHybridProxyUrl(url) &&
    process.env.SUPABASE_LOCAL_ALLOW_REMOTE_ADMIN !== "true"
  ) {
    console.error(
      "[createSupabaseAdmin] Bloqueado: NEXT_PUBLIC_SUPABASE_URL aponta para o proxy local do stack híbrido, " +
        "mas a service role key é do projeto Supabase REMOTO — ações admin (criar/deletar usuário, upload/delete de arquivo) " +
        "mutariam dados reais do projeto remoto. Defina SUPABASE_LOCAL_ALLOW_REMOTE_ADMIN=true em " +
        "docker/local/.env.local-stack para permitir (use um projeto Supabase de desenvolvimento isolado, nunca produção)."
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
