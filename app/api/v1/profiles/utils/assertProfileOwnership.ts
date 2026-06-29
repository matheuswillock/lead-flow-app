import type { NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { createSupabaseServer } from "@/lib/supabase/server"

export type ProfileOwnershipAccessResult =
  | { supabaseId: string; error?: never; status?: never }
  | { supabaseId?: never; error: Output; status: number }

export async function assertProfileOwnership(
  request: NextRequest,
  requestedSupabaseId: string,
): Promise<ProfileOwnershipAccessResult> {
  let authenticatedSupabaseId = request.headers.get("x-supabase-user-id")

  if (!authenticatedSupabaseId) {
    const supabase = await createSupabaseServer()
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      authenticatedSupabaseId = user?.id ?? null
    }
  }

  if (!authenticatedSupabaseId) {
    return {
      error: new Output(false, [], ["Não autenticado"], null),
      status: 401,
    }
  }

  if (authenticatedSupabaseId !== requestedSupabaseId) {
    return {
      error: new Output(false, [], ["Acesso negado"], null),
      status: 403,
    }
  }

  return { supabaseId: authenticatedSupabaseId }
}
