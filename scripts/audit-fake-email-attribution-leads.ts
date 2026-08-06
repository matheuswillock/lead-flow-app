import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

/**
 * Diagnóstico read-only: leads de atribuição campanha sem submissão real,
 * e métricas form_viewed recentes que ainda criariam fantasmas (E1).
 *
 * Uso:
 *   bun run audit:fake-email-attribution-leads
 *   bun run audit:fake-email-attribution-leads --since=2026-08-05
 */
async function main() {
  const sinceArg = process.argv.find((arg) => arg.startsWith("--since="))
  const since = sinceArg ? new Date(sinceArg.slice("--since=".length)) : undefined

  const affected = await prisma.lead.findMany({
    where: {
      originMetadata: { path: ["attribution"], equals: "email_campaign" },
      publicFormSubmissions: { none: {} },
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      teamId: true,
      team: { select: { name: true } },
      originMetadata: true,
    },
    orderBy: { createdAt: "desc" },
  })

  console.info(`[audit-fake-email-attribution-leads] ${affected.length} leads campanha sem submissão`)

  const formViewedSince = since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentFormViewed = await prisma.publicFormMetricEvent.count({
    where: {
      eventType: "form_viewed",
      createdAt: { gte: formViewedSince },
    },
  })

  const formStartedWithoutLead = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM corretor_studio_public_form_metric_events e
    WHERE e."eventType" = 'form_started'
      AND e."createdAt" >= ${formViewedSince}
      AND (e.origin->>'emailLogId') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM corretor_studio_leads l
        WHERE l."teamId" = (
          SELECT f."teamId" FROM corretor_studio_public_forms f WHERE f.id = e."formId"
        )
        AND l.email IS NOT NULL
        AND lower(l.email) = lower(
          (SELECT el."recipientEmail" FROM corretor_studio_email_logs el
           WHERE el.id::text = e.origin->>'emailLogId' LIMIT 1)
        )
      )
  `

  console.info(`[audit-fake-email-attribution-leads] form_viewed (7d ou --since): ${recentFormViewed}`)
  console.info(
    `[audit-fake-email-attribution-leads] form_started sem lead CRM: ${Number(formStartedWithoutLead[0]?.count ?? 0)}`,
  )

  for (const lead of affected) {
    const meta = (lead.originMetadata ?? {}) as Record<string, unknown>
    console.info(
      [
        lead.id,
        lead.team?.name ?? lead.teamId,
        lead.email ?? "",
        lead.createdAt.toISOString(),
        meta.campaignId ?? "",
        meta.emailLogId ?? "",
      ].join(","),
    )
  }
}

main()
  .catch((error) => {
    console.error("[audit-fake-email-attribution-leads]", error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
