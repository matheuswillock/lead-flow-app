import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !serviceKey) {
  console.error("[seed] Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.")
  process.exit(1)
}

export const supabase = createClient(url, serviceKey)
export const supabaseAnon = anonKey ? createClient(url, anonKey) : null

export type SeedUser = { email: string; password: string; fullName?: string }

export function resolveSeedPassword(): string {
  const fromEnv = process.env.SEED_USER_PASSWORD?.trim()
  if (fromEnv) return fromEnv

  const generated = `${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}Aa1!`
  console.info(
    "[seed] SEED_USER_PASSWORD ausente; usando senha temporária gerada (copie agora):",
    generated
  )
  return generated
}

export async function listUserByEmail(email: string) {
  let page = 1
  const perPage = 1000
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (found) return found
    if (data.users.length < perPage) return null
    page += 1
  }
}

export async function ensureUser(u: SeedUser) {
  let user = await listUserByEmail(u.email)

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    })
    if (error) {
      const msg = (error as any)?.message?.toLowerCase?.() || ""
      if (error.status === 422 || msg.includes("already") || error.status === 500) {
        user = await listUserByEmail(u.email)
        if (!user && supabaseAnon) {
          const { data: su, error: suErr } = await supabaseAnon.auth.signUp({
            email: u.email,
            password: u.password,
          })
          if (!suErr) user = su.user ?? (await listUserByEmail(u.email))
        }
      } else {
        throw error
      }
    } else {
      user = data?.user ?? null
    }
  }

  if (!user) throw new Error(`[seed] Não foi possível resolver o usuário ${u.email}`)

  const { data: updated, error: updErr } = await supabase.auth.admin.updateUserById(user.id, {
    email_confirm: true,
    password: u.password,
  })
  if (updErr) throw updErr

  console.info(`[seed] Usuário pronto: ${u.email} (id: ${updated.user.id})`)
  return updated.user
}
