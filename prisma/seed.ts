/**
 * Entrypoint do Prisma seed — executa app + backoffice em sequência.
 * Chamado por: bunx prisma db seed  /  bun run prisma:seed
 *
 * Para executar separadamente:
 *   bun run db:seed:app
 *   bun run db:seed:backoffice
 */
import { ensureUser, type SeedUser } from "./seed-helpers"
import { PrismaClient, UserRole } from "@prisma/client"
import { listUserByEmail } from "./seed-helpers"

const prisma = new PrismaClient()

// ── App users ────────────────────────────────────────────────────────────────

const APP_USERS: SeedUser[] = [
  { email: "bruno@onsidemarketing.com.br", password: "Onside@2025" },
  { email: "nathielewillock@gmail.com", password: "Teste@2025" },
  { email: "matheuswillock@gmail.com", password: "Nath@1308" },
]

// ── Backoffice users ──────────────────────────────────────────────────────────

const BACKOFFICE_USERS = [
  {
    email: "matheuswillock@corretorstudio.com",
    password: "Backoffice@2025",
    fullAccess: true,
  },
]

async function ensureBackofficeUser(supabaseId: string, email: string, fullAccess: boolean) {
  const profile = await prisma.profile.upsert({
    where: { email },
    create: { email, role: UserRole.backoffice, supabaseId, isMaster: false },
    update: { role: UserRole.backoffice, supabaseId },
  })

  await prisma.backofficeUser.upsert({
    where: { profileId: profile.id },
    create: { id: profile.id, profileId: profile.id, email, fullAccess, isActive: true },
    update: { fullAccess, isActive: true, email },
  })

  console.info(`[seed] BackofficeUser pronto: ${email}`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.info("[seed] Iniciando (app + backoffice)...")

  for (const u of APP_USERS) {
    await ensureUser(u)
  }

  for (const u of BACKOFFICE_USERS) {
    await ensureUser(u)
    const authUser = await listUserByEmail(u.email)
    if (authUser) {
      await ensureBackofficeUser(authUser.id, u.email, u.fullAccess)
    }
  }

  console.info("[seed] Concluído.")
}

main().catch((e) => {
  console.error("[seed] Falhou:", e)
  process.exit(1)
}).finally(() => prisma.$disconnect())
