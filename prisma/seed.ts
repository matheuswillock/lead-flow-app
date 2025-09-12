import { createClient } from "@supabase/supabase-js"

type SeedUser = { email: string; password: string; fullName?: string }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !serviceKey) {
  console.error("[seed] Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.")
  process.exit(1)
}

const supabase = createClient(url, serviceKey)
const supabaseAnon = anonKey ? createClient(url, anonKey) : null

async function listUserByEmail(email: string) {
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

async function ensureUser(u: SeedUser) {
  // 1) Buscar primeiro (idempotente)
  let user = await listUserByEmail(u.email)

  // 2) Criar se não existir
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    })
    if (error) {
      // 422 (already exists) ou alguns 500 intermitentes → rechecagem
      const msg = (error as any)?.message?.toLowerCase?.() || ""
      if (error.status === 422 || msg.includes("already") || error.status === 500) {
        user = await listUserByEmail(u.email)
        // fallback opcional via anon signUp
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

  // 3) Garantir confirmação e senha atual
  const { data: updated, error: updErr } = await supabase.auth.admin.updateUserById(user.id, {
    email_confirm: true,
    password: u.password,
  })
  if (updErr) throw updErr

  console.info(`[seed] Usuário pronto: ${u.email} (id: ${updated.user.id})`)
}

async function main() {
  console.info("[seed] Iniciando...")
  const users: SeedUser[] = [
    { email: "bruno@onsidemarketing.com.br", password: "Onside@2025" },
    { email: "nathielewillock@gmail.com", password: "Teste@2025" },
    { email: "matheuswillock@gmail.com", password: "Nath@1308" }
  ]

  for (const u of users) {
    await ensureUser(u)
  }
  console.info("[seed] Concluído.")
}

main().catch((e) => {
  console.error("[seed] Falhou:", e)
  process.exit(1)
})