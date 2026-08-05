import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Diagnóstico read-only (nenhuma escrita) para leads criados pelo
 * ResolveEmailCampaignFormAttributionUseCase a partir de um simples
 * `form_viewed` (carregamento de página / prefetch de scanner de e-mail),
 * sem nenhuma PublicFormSubmission real correspondente.
 *
 * Critério: originMetadata.attribution === "email_campaign" E nenhuma
 * linha em PublicFormSubmission aponta para esse leadId.
 *
 * Uso: bun run audit:fake-email-attribution-leads
 */
async function main() {
  const affected = await prisma.lead.findMany({
    where: {
      originMetadata: { path: ["attribution"], equals: "email_campaign" },
      publicFormSubmissions: { none: {} },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      statusEnteredAt: true,
      teamId: true,
      team: { select: { name: true } },
      originMetadata: true,
    },
    orderBy: { createdAt: "desc" },
  });

  console.info(`[audit-fake-email-attribution-leads] ${affected.length} leads afetados encontrados`);

  const byTeam = new Map<string, number>();
  for (const lead of affected) {
    const teamName = lead.team?.name ?? lead.teamId ?? "—";
    byTeam.set(teamName, (byTeam.get(teamName) ?? 0) + 1);
  }

  console.info("\nPor time:");
  for (const [teamName, count] of [...byTeam.entries()].sort((a, b) => b[1] - a[1])) {
    console.info(`  ${teamName}: ${count}`);
  }

  console.info("\nDetalhe:");
  console.info("id,teamName,name,email,phone,status,createdAt,campaignId,emailLogId");
  for (const lead of affected) {
    const meta = (lead.originMetadata ?? {}) as Record<string, unknown>;
    console.info(
      [
        lead.id,
        lead.team?.name ?? lead.teamId ?? "—",
        JSON.stringify(lead.name ?? ""),
        lead.email ?? "",
        lead.phone ?? "",
        lead.status,
        lead.createdAt.toISOString(),
        (meta.campaignId as string) ?? "",
        (meta.emailLogId as string) ?? "",
      ].join(","),
    );
  }
}

main()
  .catch((error) => {
    console.error("[audit-fake-email-attribution-leads]", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
