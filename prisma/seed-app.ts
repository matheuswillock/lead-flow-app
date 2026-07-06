/**
 * Seed de aplicação — usuários de teste da plataforma principal (managers/operators).
 * Execução: bun run db:seed:app
 */
import { ensureUser, resolveSeedPassword, type SeedUser } from "./seed-helpers"

const seedPassword = resolveSeedPassword()

const users: SeedUser[] = [
  { email: "bruno@onsidemarketing.com.br", password: seedPassword },
  { email: "nathielewillock@gmail.com", password: seedPassword },
  { email: "matheuswillock@gmail.com", password: seedPassword },
]

async function main() {
  console.info("[seed:app] Iniciando...")
  for (const u of users) {
    await ensureUser(u)
  }
  console.info("[seed:app] Concluído.")
}

main().catch((e) => {
  console.error("[seed:app] Falhou:", e)
  process.exit(1)
})
