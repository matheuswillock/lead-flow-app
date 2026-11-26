import { cookies } from "next/headers"

import { resolveE2eUser } from "@/lib/e2e/resolve-e2e-user"
import { createSupabaseServer } from "@/lib/supabase/server"

/**
 * Id do usuário logado para páginas do servidor fora do layout autenticado. Aceita o cookie
 * assinado do E2E, como o bootstrap da conta; sem sessão devolve null.
 */
export async function getServerSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const e2eUser = await resolveE2eUser((name) => cookieStore.get(name)?.value)
  if (e2eUser) return e2eUser.id

  const supabase = await createSupabaseServer()
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}
