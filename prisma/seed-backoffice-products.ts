/**
 * Seed dos produtos do backoffice (BackofficeProduct).
 * Execução: bun run db:seed:backoffice-products
 */
import {
  BackofficeAdhesionBillingCycle,
  BackofficePaymentMethod,
  BackofficeProductBillingMode,
  BackofficeProductType,
  PrismaClient,
} from "@prisma/client"

const prisma = new PrismaClient()

const PRODUCTS = [
  {
    slug: "crm",
    name: "CRM",
    description: "Plano CRM — acesso completo ao módulo de gestão de leads.",
    type: BackofficeProductType.PLAN,
    billingMode: BackofficeProductBillingMode.RECURRING,
    priceMonthly: 89.9,
    priceQuarterly: 79.9,
    priceSemiannual: 69.9,
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

const CRM_PAYMENT_RULES: Array<{
  paymentMethod: BackofficePaymentMethod
  billingCycle: BackofficeAdhesionBillingCycle
  price: number
  canInstallment: boolean
  maxInstallments: number
}> = [
  { paymentMethod: BackofficePaymentMethod.PIX, billingCycle: BackofficeAdhesionBillingCycle.monthly, price: 89.9, canInstallment: false, maxInstallments: 1 },
  { paymentMethod: BackofficePaymentMethod.PIX, billingCycle: BackofficeAdhesionBillingCycle.quarterly, price: 79.9, canInstallment: false, maxInstallments: 1 },
  { paymentMethod: BackofficePaymentMethod.PIX, billingCycle: BackofficeAdhesionBillingCycle.semiannual, price: 69.9, canInstallment: false, maxInstallments: 1 },
  { paymentMethod: BackofficePaymentMethod.CREDIT_CARD, billingCycle: BackofficeAdhesionBillingCycle.monthly, price: 102.9, canInstallment: false, maxInstallments: 1 },
  { paymentMethod: BackofficePaymentMethod.CREDIT_CARD, billingCycle: BackofficeAdhesionBillingCycle.quarterly, price: 91.4, canInstallment: true, maxInstallments: 3 },
  { paymentMethod: BackofficePaymentMethod.CREDIT_CARD, billingCycle: BackofficeAdhesionBillingCycle.semiannual, price: 79.9, canInstallment: true, maxInstallments: 6 },
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
        priceMonthly: product.priceMonthly,
        priceQuarterly: product.priceQuarterly,
        priceSemiannual: product.priceSemiannual,
        isActive: product.isActive,
      },
    })
    console.info(`[seed:backoffice-products] Produto pronto: ${product.slug}`)
  }

  const crmProduct = await prisma.backofficeProduct.findUnique({ where: { slug: "crm" } })
  if (crmProduct) {
    for (const rule of CRM_PAYMENT_RULES) {
      await prisma.backofficeProductPaymentRule.upsert({
        where: {
          productId_paymentMethod_billingCycle: {
            productId: crmProduct.id,
            paymentMethod: rule.paymentMethod,
            billingCycle: rule.billingCycle,
          },
        },
        create: { productId: crmProduct.id, ...rule },
        update: { price: rule.price, canInstallment: rule.canInstallment, maxInstallments: rule.maxInstallments },
      })
    }
    console.info("[seed:backoffice-products] Regras de pagamento CRM prontas")
  }

  console.info("[seed:backoffice-products] Concluído.")
}

main()
  .catch((e) => {
    console.error("[seed:backoffice-products] Falhou:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
