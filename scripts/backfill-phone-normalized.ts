import { prisma } from "@/app/api/infra/data/prisma";
import { normalizePhone } from "@/lib/phone";

async function main() {
  const leads = await prisma.lead.findMany({
    where: {
      phone: { not: null },
      phoneNormalized: null
    },
    select: { id: true, phone: true }
  });

  let updated = 0;

  for (const lead of leads) {
    const normalized = normalizePhone(lead.phone);
    if (!normalized) continue;

    await prisma.lead.update({
      where: { id: lead.id },
      data: { phoneNormalized: normalized }
    });

    updated += 1;
  }

  console.info(`Backfill concluido. Leads atualizados: ${updated}`);
}

main()
  .catch((error) => {
    console.error("Erro no backfill:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
