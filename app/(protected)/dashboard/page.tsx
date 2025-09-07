import { createSupabaseServer } from "@/lib/supabase/server"


export default async function Dashboard() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-sm text-muted-foreground">Olá, {user?.email}</p>
    </main>
  )
}
