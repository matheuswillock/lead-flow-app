/**
 * Seed de aplicação — usuários de teste da plataforma principal (managers/operators).
 * Execução: bun run db:seed:app
 */
import { ensureUser, type SeedUser } from "./seed-helpers"

const users: SeedUser[] = [
  { email: "bruno@onsidemarketing.com.br", password: "Onside@2025" },
  { email: "nathielewillock@gmail.com", password: "Teste@2025" },
  { email: "matheuswillock@gmail.com", password: "Nath@1308" },
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
