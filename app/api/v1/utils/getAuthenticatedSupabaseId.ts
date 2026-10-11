import type { NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { createSupabaseServer } from "@/lib/supabase/server"

export type AuthenticatedSupabaseIdResult =
  | { supabaseId: string; error?: never; status?: never }
  | { supabaseId?: never; error: Output; status: number }

export async function getAuthenticatedSupabaseId(request: NextRequest): Promise<AuthenticatedSupabaseIdResult> {
  const supabase = await createSupabaseServer()
  if (!supabase) {
    return { error: new Output(false, [], ["Não autenticado"], null), status: 401 }
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    return { error: new Output(false, [], ["Não autenticado"], null), status: 401 }
  }

  const requestedSupabaseId = request.headers.get("x-supabase-user-id")
  if (requestedSupabaseId && requestedSupabaseId !== user.id) {
    return { error: new Output(false, [], ["Acesso negado"], null), status: 403 }
  }

  return { supabaseId: user.id }
}
