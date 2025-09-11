"use server"

import { redirect } from "next/navigation"
import { createSupabaseServer } from "@/lib/supabase/server"

export async function signout() {
  const supabase = await createSupabaseServer()
  await supabase?.auth.signOut()
  // Redireciona imediatamente após limpar a sessão
  redirect("/sign-in")
}
