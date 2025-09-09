import { createSupabaseServer } from "@/lib/supabase/server"


export default async function Dashboard() {
  const supabase = await createSupabaseServer()
  let user: any = null
  if (supabase) {
    const { data } = await supabase.auth.getUser()
    user = data.user
  }
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-sm text-muted-foreground">Olá, {user?.email}</p>
    </div>
  )
}
