/**
 * Seed dos produtos do backoffice (BackofficeProduct).
 * Execução: bun run db:seed:backoffice-products
 */
import { PrismaClient, BackofficeProductType, BackofficeProductBillingMode } from "@prisma/client"

const prisma = new PrismaClient()

const PRODUCTS = [
  {
    slug: "crm",
    name: "CRM",
    description: "Plano CRM — acesso completo ao módulo de gestão de leads.",
    type: BackofficeProductType.PLAN,
    billingMode: BackofficeProductBillingMode.RECURRING,
    priceMonthly: 79.9,
    priceQuarterly: 69.9,
    priceSemiannual: 59.9,
    priceLifetime: null,
    isActive: true,
  },
  {
    slug: "crm-lifetime",
    name: "CRM Vitalício",
    description: "Plano CRM com acesso vitalício — pagamento único, sem mensalidade.",
    type: BackofficeProductType.PLAN,
    billingMode: BackofficeProductBillingMode.LIFETIME,
    priceMonthly: null,
    priceQuarterly: null,
    priceSemiannual: null,
    priceLifetime: null,
    isActive: true,
  },
  {
    slug: "extra-team",
    name: "Time Adicional",
    description: "Adiciona um time extra à conta.",
    type: BackofficeProductType.ADDON,
    billingMode: BackofficeProductBillingMode.RECURRING,
    priceMonthly: 29.9,
    priceQuarterly: 29.9,
    priceSemiannual: 29.9,
    priceLifetime: null,
    isActive: true,
  },
  {
    slug: "extra-user",
    name: "Usuário Adicional",
    description: "Adiciona um usuário operador extra à conta.",
    type: BackofficeProductType.ADDON,
    billingMode: BackofficeProductBillingMode.RECURRING,
    priceMonthly: 19.9,
    priceQuarterly: 19.9,
    priceSemiannual: 19.9,
    priceLifetime: null,
    isActive: true,
  },
]

async function main() {
  console.info("[seed:backoffice-products] Iniciando...")

  for (const product of PRODUCTS) {
    await prisma.backofficeProduct.upsert({
      where: { slug: product.slug },
      create: product,
      update: {
        name: product.name,
        description: product.description,
        type: product.type,
        billingMode: product.billingMode,
        isActive: product.isActive,
      },
    })
    console.info(`[seed:backoffice-products] Produto pronto: ${product.slug}`)
  }

  console.info("[seed:backoffice-products] Concluído.")
}

main()
  .catch((e) => {
    console.error("[seed:backoffice-products] Falhou:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
