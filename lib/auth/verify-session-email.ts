import { createSupabaseAdmin } from "@/lib/supabase/server"

export async function verifySessionEmail(accessToken: string | null | undefined): Promise<string | null> {
  if (!accessToken) return null
  const supabase = createSupabaseAdmin()
  if (!supabase) return null

  const { data, error } = await supabase.auth.getUser(accessToken)
  if (error || !data.user?.email) return null
  return data.user.email
}
