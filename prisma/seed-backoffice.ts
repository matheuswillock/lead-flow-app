/**
 * Seed de backoffice — usuário inicial com fullAccess=true.
 * Execução: bun run db:seed:backoffice
 */
import { PrismaClient, UserRole } from "@prisma/client"
import { ensureUser, listUserByEmail } from "./seed-helpers"

const prisma = new PrismaClient()

const BACKOFFICE_USERS = [
  {
    email: "matheuswillock@corretorstudio.com",
    password: "Backoffice@2025",
    fullName: "Matheus Willock",
    fullAccess: true,
  },
]

async function ensureBackofficeUser(supabaseId: string, email: string, fullAccess: boolean) {
  const profile = await prisma.profile.upsert({
    where: { email },
    create: {
      email,
      role: UserRole.backoffice,
      supabaseId,
      isMaster: false,
    },
    update: {
      role: UserRole.backoffice,
      supabaseId,
    },
  })

  await prisma.backofficeUser.upsert({
    where: { profileId: profile.id },
    create: {
      id: profile.id,
      profileId: profile.id,
      email,
      fullAccess,
      isActive: true,
    },
    update: {
      fullAccess,
      isActive: true,
      email,
    },
  })

  console.info(`[seed:backoffice] BackofficeUser pronto: ${email} (profileId: ${profile.id}, fullAccess: ${fullAccess})`)
}

async function main() {
  console.info("[seed:backoffice] Iniciando...")

  for (const u of BACKOFFICE_USERS) {
    await ensureUser(u)
    const authUser = await listUserByEmail(u.email)
    if (authUser) {
      await ensureBackofficeUser(authUser.id, u.email, u.fullAccess)
    } else {
      console.warn(`[seed:backoffice] Auth user não encontrado para ${u.email}, pulando.`)
    }
  }

  console.info("[seed:backoffice] Concluído.")
}

main().catch((e) => {
  console.error("[seed:backoffice] Falhou:", e)
  process.exit(1)
}).finally(() => prisma.$disconnect())
