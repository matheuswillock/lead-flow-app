/**
 * Enfileira sync Radar (D9 outbox) para contatos de uma lista sem identity
 * `email_contact_id` — ex.: listas materializadas / importadas antes do outbox.
 *
 * Uso:
 *   bun scripts/backfill-email-contact-radar-sync-outbox.ts --teamId=<uuid> --listId=<uuid>
 *   bun scripts/backfill-email-contact-radar-sync-outbox.ts --teamId=<uuid> --listId=<uuid> --listId=<uuid2>
 */

import { emailContactRadarSyncOutboxRepository } from "@/app/api/infra/data/repositories/emailContactRadarSyncOutbox/EmailContactRadarSyncOutboxRepository"
import { prisma } from "@/app/api/infra/data/prisma"

function readArgValues(name: string): string[] {
  const prefix = `--${name}=`
  return process.argv.filter((arg) => arg.startsWith(prefix)).map((arg) => arg.slice(prefix.length))
}

async function main() {
  const teamId = readArgValues("teamId")[0]
  const listIds = readArgValues("listId")

  if (!teamId || listIds.length === 0) {
    console.error(
      "Uso: bun scripts/backfill-email-contact-radar-sync-outbox.ts --teamId=<uuid> --listId=<uuid> [--listId=<uuid>...]"
    )
    process.exitCode = 1
    return
  }

  for (const listId of listIds) {
    const list = await prisma.emailContactList.findFirst({
      where: { id: listId, teamId },
      select: { id: true, name: true, totalContacts: true },
    })
    if (!list) {
      console.error("[backfill-email-contact-radar-sync-outbox] lista não encontrada no time", {
        teamId,
        listId,
      })
      process.exitCode = 1
      continue
    }

    const enqueued = await emailContactRadarSyncOutboxRepository.enqueueMissingForList(
      teamId,
      listId
    )
    console.info("[backfill-email-contact-radar-sync-outbox] ok", {
      listId,
      name: list.name,
      totalContacts: list.totalContacts,
      enqueued,
    })
  }
}

main()
  .catch((error) => {
    console.error("[backfill-email-contact-radar-sync-outbox]", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
