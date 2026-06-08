/**
 * Seed de aplicação — usuários de teste da plataforma principal (managers/operators).
 * Execução: bun run db:seed:app
 */
import { PrismaClient } from "@prisma/client";
import { ensureUser, listUserByEmail, type SeedUser } from "./seed-helpers"
import { ensureAppSeedProfile } from "./seed-profile-helpers";

const users: SeedUser[] = [
  { email: "bruno@onsidemarketing.com.br", password: "Onside@2025" },
  { email: "nathielewillock@gmail.com", password: "Teste@2025" },
  { email: "matheuswillock@gmail.com", password: "Nath@1308" },
]

const existingAuthUsersToBackfill = [
  "matheuswillock@outlook.com",
]

const prisma = new PrismaClient();

async function main() {
  console.info("[seed:app] Iniciando...")
  for (const u of users) {
    const authUser = await ensureUser(u)
    await ensureAppSeedProfile(prisma, authUser)
  }

  for (const email of existingAuthUsersToBackfill) {
    const authUser = await listUserByEmail(email)
    if (!authUser) {
      console.warn(`[seed:app] Auth user não encontrado para backfill: ${email}`)
      continue
    }
    await ensureAppSeedProfile(prisma, authUser)
  }

  console.info("[seed:app] Concluído.")
}

main().catch((e) => {
  console.error("[seed:app] Falhou:", e)
  process.exit(1)
}).finally(() => prisma.$disconnect())
