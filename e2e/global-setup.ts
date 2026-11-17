/**
 * Setup global do Playwright: prepara, uma única vez, os dados que várias specs
 * compartilham e que o `db:seed:e2e` não cria (landing pages publicadas).
 *
 * Roda antes de qualquer spec. Se o banco ou o seed não estiverem prontos o run
 * falha aqui, com a causa, em vez de cada spec pular em silêncio.
 */

import { arrangeLandingFixtures } from "./support/landing-pages"
import { disconnectPrisma } from "./support/db"

export default async function globalSetup(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.warn("[e2e:global-setup] DATABASE_URL ausente; landing pages E2E não foram preparadas.")
    return
  }
  try {
    await arrangeLandingFixtures()
  } finally {
    await disconnectPrisma()
  }
}
