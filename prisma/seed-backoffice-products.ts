/**
 * Seed dos produtos do backoffice (BackofficeProduct).
 * Execução: bun run db:seed:backoffice-products
 */
import {
  BackofficeAccessPrincipal,
  BackofficeAdhesionBillingCycle,
  BackofficeFeatureAccessLevel,
  BackofficeFeatureAccessMode,
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
    priceAnnual: 69.9,
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
    priceAnnual: null,
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
    priceAnnual: 29.9,
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
    priceAnnual: 19.9,
    priceLifetime: null,
    isActive: true,
  },
  {
    slug: "email",
    name: "Email",
    description: "Módulo de email para campanhas, contatos, templates e analytics.",
    type: BackofficeProductType.ADDON,
    billingMode: BackofficeProductBillingMode.RECURRING,
    priceMonthly: 29.9,
    priceQuarterly: 29.9,
    priceSemiannual: 29.9,
    priceAnnual: 29.9,
    priceLifetime: null,
    isActive: true,
  },
  {
    slug: "whatsapp",
    name: "WhatsApp",
    description: "Módulo WhatsApp — inbox, conversas e envio de mensagens via Evolution API.",
    type: BackofficeProductType.ADDON,
    billingMode: BackofficeProductBillingMode.RECURRING,
    priceMonthly: 39.9,
    priceQuarterly: 34.9,
    priceSemiannual: 29.9,
    priceAnnual: 29.9,
    priceLifetime: null,
    isActive: true,
  },
  {
    slug: "cdp",
    name: "CDP",
    description: "CDP — perfis unificados, segmentos e timeline para campanhas de e-mail.",
    type: BackofficeProductType.ADDON,
    billingMode: BackofficeProductBillingMode.RECURRING,
    priceMonthly: 29.9,
    priceQuarterly: 29.9,
    priceSemiannual: 29.9,
    priceAnnual: 29.9,
    priceLifetime: null,
    isActive: true,
  },
]

// Features sem parentSlug são guarda-chuvas. Features com parentSlug herdam acesso do pai por padrão.
const FEATURES_WITHOUT_PARENT_INHERITANCE = new Set([
  "crm-lead-transfers",
  "crm-backoffice-associados",
  "email-settings",
  "whatsapp-auto-responses",
])

function resolveInheritParentSettings(slug: string, parentSlug?: string): boolean {
  if (!parentSlug) return false
  return !FEATURES_WITHOUT_PARENT_INHERITANCE.has(slug)
}

const FEATURES: Array<{
  slug: string
  name: string
  accessMode: BackofficeFeatureAccessMode
  defaultAccessLevel: BackofficeFeatureAccessLevel
  betaEnabled: boolean
  inheritParentSettings: boolean
  sortOrder: number
  parentSlug?: string
  productSlug: string | null
}> = [
  // ── CRM guarda-chuva ──────────────────────────────────────────────────────
  { slug: "crm", name: "CRM", accessMode: BackofficeFeatureAccessMode.PAID, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: false, sortOrder: 10, productSlug: "crm" },
  { slug: "crm-dashboard",        name: "Dashboard",          accessMode: BackofficeFeatureAccessMode.PAID, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: true, sortOrder: 20, parentSlug: "crm", productSlug: "crm" },
  { slug: "crm-lead-transfers",   name: "Transferências",     accessMode: BackofficeFeatureAccessMode.PAID, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: false, sortOrder: 35, parentSlug: "crm", productSlug: "crm" },
  { slug: "crm-backoffice-associados", name: "Associados",   accessMode: BackofficeFeatureAccessMode.PAID, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: false, sortOrder: 36, parentSlug: "crm", productSlug: "crm" },
  { slug: "crm-calendar",         name: "Calendário",         accessMode: BackofficeFeatureAccessMode.PAID, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: true, sortOrder: 40, parentSlug: "crm", productSlug: "crm" },
  { slug: "crm-performance",      name: "Performance",        accessMode: BackofficeFeatureAccessMode.PAID, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: true, sortOrder: 50, parentSlug: "crm", productSlug: "crm" },
  { slug: "crm-simulator",        name: "Simulador de Planos",accessMode: BackofficeFeatureAccessMode.PAID, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: true, sortOrder: 60, parentSlug: "crm", productSlug: "crm" },
  { slug: "crm-time",             name: "Time",               accessMode: BackofficeFeatureAccessMode.PAID, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: true, sortOrder: 70, parentSlug: "crm", productSlug: "crm" },
  { slug: "crm-time-manage-teams",name: "Gerenciar Times",    accessMode: BackofficeFeatureAccessMode.PAID, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: true, sortOrder: 80, parentSlug: "crm", productSlug: "extra-team" },
  { slug: "crm-time-manage-users",name: "Gerenciar Usuários", accessMode: BackofficeFeatureAccessMode.PAID, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: true, sortOrder: 90, parentSlug: "crm", productSlug: "extra-user" },
  { slug: "crm-wallet",           name: "Carteira",           accessMode: BackofficeFeatureAccessMode.PAID, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: true, sortOrder: 95, parentSlug: "crm", productSlug: "crm" },

  // ── Email guarda-chuva ────────────────────────────────────────────────────
  { slug: "email",               name: "Email",     accessMode: BackofficeFeatureAccessMode.ADDON, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: true,  inheritParentSettings: false, sortOrder: 100, productSlug: "email" },
  { slug: "email-templates",     name: "Templates", accessMode: BackofficeFeatureAccessMode.ADDON, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: true, sortOrder: 110, parentSlug: "email", productSlug: "email" },
  { slug: "email-contacts",      name: "Contatos",  accessMode: BackofficeFeatureAccessMode.ADDON, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: true, sortOrder: 120, parentSlug: "email", productSlug: "email" },
  { slug: "email-campaigns",     name: "Campanhas", accessMode: BackofficeFeatureAccessMode.ADDON, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: true, sortOrder: 130, parentSlug: "email", productSlug: "email" },
  { slug: "email-history",       name: "Histórico", accessMode: BackofficeFeatureAccessMode.ADDON, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: true, sortOrder: 140, parentSlug: "email", productSlug: "email" },
  { slug: "email-analytics",     name: "Analytics",      accessMode: BackofficeFeatureAccessMode.ADDON, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: true, sortOrder: 150, parentSlug: "email", productSlug: "email" },
  { slug: "email-settings",     name: "Configurações",  accessMode: BackofficeFeatureAccessMode.ADDON, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: false, sortOrder: 160, parentSlug: "email", productSlug: "email" },

  // ── WhatsApp guarda-chuva ─────────────────────────────────────────────────
  { slug: "whatsapp",                name: "WhatsApp",               accessMode: BackofficeFeatureAccessMode.ADDON, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: true,  inheritParentSettings: false, sortOrder: 170, productSlug: "whatsapp" },
  { slug: "whatsapp-auto-responses", name: "Auto-respostas",         accessMode: BackofficeFeatureAccessMode.ADDON, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: false, sortOrder: 172, parentSlug: "whatsapp", productSlug: "whatsapp" },
  { slug: "whatsapp-settings",       name: "Configurações WhatsApp", accessMode: BackofficeFeatureAccessMode.ADDON, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: true, sortOrder: 175, parentSlug: "whatsapp", productSlug: "whatsapp" },

  { slug: "cdp", name: "CDP", accessMode: BackofficeFeatureAccessMode.ADDON, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: true, inheritParentSettings: false, sortOrder: 180, productSlug: "cdp" },

  // ── Integração guarda-chuva ───────────────────────────────────────────────
  { slug: "integration", name: "Integração", accessMode: BackofficeFeatureAccessMode.PUBLIC, defaultAccessLevel: BackofficeFeatureAccessLevel.NONE, betaEnabled: true, inheritParentSettings: false, sortOrder: 200, productSlug: null },
]

const WHATSAPP_PAYMENT_RULES: Array<{
  paymentMethod: BackofficePaymentMethod
  billingCycle: BackofficeAdhesionBillingCycle
  price: number
  canInstallment: boolean
  maxInstallments: number
}> = [
  { paymentMethod: BackofficePaymentMethod.PIX,         billingCycle: BackofficeAdhesionBillingCycle.monthly,    price: 39.9, canInstallment: false, maxInstallments: 1 },
  { paymentMethod: BackofficePaymentMethod.PIX,         billingCycle: BackofficeAdhesionBillingCycle.quarterly,  price: 34.9, canInstallment: false, maxInstallments: 1 },
  { paymentMethod: BackofficePaymentMethod.PIX,         billingCycle: BackofficeAdhesionBillingCycle.semiannual, price: 29.9, canInstallment: false, maxInstallments: 1 },
  { paymentMethod: BackofficePaymentMethod.PIX,         billingCycle: BackofficeAdhesionBillingCycle.annual,     price: 29.9, canInstallment: false, maxInstallments: 1 },
  { paymentMethod: BackofficePaymentMethod.CREDIT_CARD, billingCycle: BackofficeAdhesionBillingCycle.monthly,    price: 45.9, canInstallment: false, maxInstallments: 1 },
  { paymentMethod: BackofficePaymentMethod.CREDIT_CARD, billingCycle: BackofficeAdhesionBillingCycle.quarterly,  price: 39.9, canInstallment: true,  maxInstallments: 3 },
  { paymentMethod: BackofficePaymentMethod.CREDIT_CARD, billingCycle: BackofficeAdhesionBillingCycle.semiannual, price: 34.9, canInstallment: true,  maxInstallments: 6 },
  { paymentMethod: BackofficePaymentMethod.CREDIT_CARD, billingCycle: BackofficeAdhesionBillingCycle.annual,     price: 34.9, canInstallment: true,  maxInstallments: 12 },
]

const CDP_PAYMENT_RULES: Array<{
  paymentMethod: BackofficePaymentMethod
  billingCycle: BackofficeAdhesionBillingCycle
  price: number
  canInstallment: boolean
  maxInstallments: number
}> = [
  { paymentMethod: BackofficePaymentMethod.PIX,         billingCycle: BackofficeAdhesionBillingCycle.monthly,    price: 29.9, canInstallment: false, maxInstallments: 1 },
  { paymentMethod: BackofficePaymentMethod.PIX,         billingCycle: BackofficeAdhesionBillingCycle.quarterly,  price: 29.9, canInstallment: false, maxInstallments: 1 },
  { paymentMethod: BackofficePaymentMethod.PIX,         billingCycle: BackofficeAdhesionBillingCycle.semiannual, price: 29.9, canInstallment: false, maxInstallments: 1 },
  { paymentMethod: BackofficePaymentMethod.PIX,         billingCycle: BackofficeAdhesionBillingCycle.annual,     price: 29.9, canInstallment: false, maxInstallments: 1 },
  { paymentMethod: BackofficePaymentMethod.CREDIT_CARD, billingCycle: BackofficeAdhesionBillingCycle.monthly,    price: 29.9, canInstallment: false, maxInstallments: 1 },
  { paymentMethod: BackofficePaymentMethod.CREDIT_CARD, billingCycle: BackofficeAdhesionBillingCycle.quarterly,  price: 29.9, canInstallment: true,  maxInstallments: 3 },
  { paymentMethod: BackofficePaymentMethod.CREDIT_CARD, billingCycle: BackofficeAdhesionBillingCycle.semiannual, price: 29.9, canInstallment: true,  maxInstallments: 6 },
  { paymentMethod: BackofficePaymentMethod.CREDIT_CARD, billingCycle: BackofficeAdhesionBillingCycle.annual,     price: 29.9, canInstallment: true,  maxInstallments: 12 },
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
  { paymentMethod: BackofficePaymentMethod.PIX, billingCycle: BackofficeAdhesionBillingCycle.annual, price: 69.9, canInstallment: false, maxInstallments: 1 },
  { paymentMethod: BackofficePaymentMethod.CREDIT_CARD, billingCycle: BackofficeAdhesionBillingCycle.monthly, price: 102.9, canInstallment: false, maxInstallments: 1 },
  { paymentMethod: BackofficePaymentMethod.CREDIT_CARD, billingCycle: BackofficeAdhesionBillingCycle.quarterly, price: 91.4, canInstallment: true, maxInstallments: 3 },
  { paymentMethod: BackofficePaymentMethod.CREDIT_CARD, billingCycle: BackofficeAdhesionBillingCycle.semiannual, price: 79.9, canInstallment: true, maxInstallments: 6 },
  { paymentMethod: BackofficePaymentMethod.CREDIT_CARD, billingCycle: BackofficeAdhesionBillingCycle.annual, price: 79.9, canInstallment: true, maxInstallments: 12 },
]

const ALL_PRINCIPALS: BackofficeAccessPrincipal[] = [
  "MASTER",
  "MANAGER",
  "BACKOFFICE",
  "OPERATOR",
  "SDR",
  "CLOSER",
  "CAN_MANAGE_TEAMS",
  "CAN_CREATE_USERS",
]

type AccessRuleSeed = {
  principal: BackofficeAccessPrincipal
  accessLevel: BackofficeFeatureAccessLevel
}

function completeRuleSet(overrides: AccessRuleSeed[]): AccessRuleSeed[] {
  const map = new Map<BackofficeAccessPrincipal, BackofficeFeatureAccessLevel>(
    ALL_PRINCIPALS.map((principal) => [principal, "NONE"])
  )
  for (const override of overrides) {
    map.set(override.principal, override.accessLevel)
  }
  return Array.from(map.entries()).map(([principal, accessLevel]) => ({
    principal,
    accessLevel,
  }))
}

const ACCESS_RULES_BY_SLUG: Record<string, AccessRuleSeed[]> = {
  crm: completeRuleSet([
    { principal: "MASTER", accessLevel: "FULL" },
    { principal: "MANAGER", accessLevel: "FULL" },
    { principal: "BACKOFFICE", accessLevel: "FULL" },
    { principal: "OPERATOR", accessLevel: "FULL" },
    { principal: "SDR", accessLevel: "FULL" },
    { principal: "CLOSER", accessLevel: "FULL" },
  ]),
  "crm-dashboard": completeRuleSet([
    { principal: "MASTER", accessLevel: "FULL" },
    { principal: "MANAGER", accessLevel: "FULL" },
    { principal: "BACKOFFICE", accessLevel: "FULL" },
    { principal: "OPERATOR", accessLevel: "FULL" },
    { principal: "SDR", accessLevel: "FULL" },
    { principal: "CLOSER", accessLevel: "FULL" },
  ]),
  "crm-lead-transfers": completeRuleSet([
    { principal: "MASTER", accessLevel: "FULL" },
    { principal: "MANAGER", accessLevel: "FULL" },
    { principal: "BACKOFFICE", accessLevel: "FULL" },
  ]),
  "crm-backoffice-associados": completeRuleSet([
    { principal: "MASTER", accessLevel: "FULL" },
    { principal: "MANAGER", accessLevel: "FULL" },
    { principal: "BACKOFFICE", accessLevel: "FULL" },
    { principal: "CAN_MANAGE_TEAMS", accessLevel: "FULL" },
  ]),
  "crm-calendar": completeRuleSet([
    { principal: "MASTER", accessLevel: "FULL" },
    { principal: "MANAGER", accessLevel: "FULL" },
    { principal: "BACKOFFICE", accessLevel: "FULL" },
    { principal: "OPERATOR", accessLevel: "FULL" },
    { principal: "SDR", accessLevel: "FULL" },
    { principal: "CLOSER", accessLevel: "FULL" },
  ]),
  "crm-simulator": completeRuleSet([
    { principal: "MASTER", accessLevel: "FULL" },
    { principal: "MANAGER", accessLevel: "FULL" },
    { principal: "BACKOFFICE", accessLevel: "FULL" },
    { principal: "OPERATOR", accessLevel: "FULL" },
    { principal: "SDR", accessLevel: "FULL" },
    { principal: "CLOSER", accessLevel: "FULL" },
  ]),
  "crm-time": completeRuleSet([
    { principal: "MASTER", accessLevel: "FULL" },
    { principal: "MANAGER", accessLevel: "FULL" },
    { principal: "BACKOFFICE", accessLevel: "FULL" },
    { principal: "OPERATOR", accessLevel: "FULL" },
    { principal: "SDR", accessLevel: "FULL" },
    { principal: "CLOSER", accessLevel: "FULL" },
  ]),
  "crm-wallet": completeRuleSet([
    { principal: "MASTER", accessLevel: "FULL" },
    { principal: "MANAGER", accessLevel: "FULL" },
    { principal: "BACKOFFICE", accessLevel: "FULL" },
    { principal: "OPERATOR", accessLevel: "NONE" },
    { principal: "SDR", accessLevel: "NONE" },
    { principal: "CLOSER", accessLevel: "NONE" },
  ]),
  "crm-performance": completeRuleSet([
    { principal: "MASTER", accessLevel: "FULL" },
    { principal: "MANAGER", accessLevel: "FULL" },
    { principal: "BACKOFFICE", accessLevel: "FULL" },
    { principal: "CLOSER", accessLevel: "FULL" },
    { principal: "SDR", accessLevel: "FULL" },
    { principal: "OPERATOR", accessLevel: "NONE" },
  ]),
  "crm-time-manage-teams": completeRuleSet([
    { principal: "MASTER", accessLevel: "FULL" },
    { principal: "CAN_MANAGE_TEAMS", accessLevel: "FULL" },
  ]),
  "crm-time-manage-users": completeRuleSet([
    { principal: "MASTER", accessLevel: "FULL" },
    { principal: "MANAGER", accessLevel: "FULL" },
    { principal: "CAN_CREATE_USERS", accessLevel: "FULL" },
  ]),
  email: completeRuleSet([
    { principal: "MASTER", accessLevel: "FULL" },
    { principal: "MANAGER", accessLevel: "FULL" },
  ]),
  "email-templates": completeRuleSet([
    { principal: "MASTER", accessLevel: "FULL" },
    { principal: "MANAGER", accessLevel: "FULL" },
  ]),
  "email-contacts": completeRuleSet([
    { principal: "MASTER", accessLevel: "FULL" },
    { principal: "MANAGER", accessLevel: "FULL" },
  ]),
  "email-campaigns": completeRuleSet([
    { principal: "MASTER", accessLevel: "FULL" },
    { principal: "MANAGER", accessLevel: "FULL" },
  ]),
  "email-history": completeRuleSet([
    { principal: "MASTER", accessLevel: "FULL" },
    { principal: "MANAGER", accessLevel: "FULL" },
  ]),
  "email-analytics": completeRuleSet([
    { principal: "MASTER", accessLevel: "FULL" },
    { principal: "MANAGER", accessLevel: "FULL" },
  ]),
  "email-settings": completeRuleSet([
    { principal: "MASTER", accessLevel: "FULL" },
    { principal: "MANAGER", accessLevel: "FULL" },
  ]),
  whatsapp: completeRuleSet([
    { principal: "MASTER",    accessLevel: "FULL" },
    { principal: "MANAGER",   accessLevel: "FULL" },
    { principal: "BACKOFFICE",accessLevel: "FULL" },
    { principal: "OPERATOR",  accessLevel: "FULL" },
    { principal: "SDR",       accessLevel: "FULL" },
    { principal: "CLOSER",    accessLevel: "FULL" },
  ]),
  "whatsapp-settings": completeRuleSet([
    { principal: "MASTER",  accessLevel: "FULL" },
    { principal: "MANAGER", accessLevel: "FULL" },
  ]),
  "whatsapp-auto-responses": completeRuleSet([
    { principal: "MASTER",  accessLevel: "FULL" },
    { principal: "MANAGER", accessLevel: "FULL" },
  ]),
  cdp: completeRuleSet([
    { principal: "MASTER", accessLevel: "FULL" },
    { principal: "MANAGER", accessLevel: "FULL" },
    { principal: "BACKOFFICE", accessLevel: "FULL" },
  ]),
  integration: completeRuleSet([{ principal: "MASTER", accessLevel: "FULL" }]),
}

async function main() {
  console.info("[seed:backoffice-products] Iniciando...")

  // 1. Upsert products
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
        priceAnnual: product.priceAnnual,
        isActive: product.isActive,
      },
    })
    console.info(`[seed:backoffice-products] Produto pronto: ${product.slug}`)
  }

  // 2. Upsert features without parentId first (resolve parents in second pass)
  for (const feature of FEATURES) {
    const inheritParentSettings = feature.inheritParentSettings
    const betaEnabled = inheritParentSettings ? false : feature.betaEnabled

    await prisma.backofficeFeature.upsert({
      where: { slug: feature.slug },
      create: {
        slug: feature.slug,
        name: feature.name,
        accessMode: feature.accessMode,
        defaultAccessLevel: feature.defaultAccessLevel,
        betaEnabled,
        inheritParentSettings,
        sortOrder: feature.sortOrder,
        productSlug: feature.productSlug,
        isActive: true,
      },
      update: {
        name: feature.name,
        accessMode: feature.accessMode,
        defaultAccessLevel: feature.defaultAccessLevel,
        betaEnabled,
        inheritParentSettings,
        sortOrder: feature.sortOrder,
        productSlug: feature.productSlug,
        isActive: true,
      },
    })
    console.info(`[seed:backoffice-products] Feature pronta: ${feature.slug}`)
  }

  // 3. Set parentId for child features
  for (const feature of FEATURES) {
    if (!feature.parentSlug) continue
    const parent = await prisma.backofficeFeature.findUnique({ where: { slug: feature.parentSlug } })
    if (!parent) {
      console.info(`[seed:backoffice-products] AVISO: pai não encontrado para ${feature.slug} (parentSlug=${feature.parentSlug})`)
      continue
    }
    await prisma.backofficeFeature.update({
      where: { slug: feature.slug },
      data: {
        parentId: parent.id,
        inheritParentSettings: resolveInheritParentSettings(feature.slug, feature.parentSlug),
      },
    })
    console.info(`[seed:backoffice-products] parentId definido: ${feature.slug} → ${feature.parentSlug}`)
  }

  // 4. Deactivate removed slugs (crm-crm was removed)
  await prisma.backofficeFeature.updateMany({
    where: { slug: { in: ["crm-crm"] } },
    data: { isActive: false },
  })
  console.info("[seed:backoffice-products] Slugs obsoletos desativados")

  // 5. Access rules by principal
  for (const [featureSlug, rules] of Object.entries(ACCESS_RULES_BY_SLUG)) {
    const feature = await prisma.backofficeFeature.findUnique({
      where: { slug: featureSlug },
      select: { id: true },
    })
    if (!feature) continue

    await prisma.$transaction(async (tx) => {
      await tx.backofficeFeatureAccessRule.deleteMany({
        where: { featureId: feature.id },
      })
      await tx.backofficeFeatureAccessRule.createMany({
        data: rules.map((rule) => ({
          featureId: feature.id,
          principal: rule.principal,
          accessLevel: rule.accessLevel,
        })),
      })
    })
  }
  console.info("[seed:backoffice-products] Regras de acesso por principal atualizadas")

  // 6. CRM payment rules
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

  // 7. WhatsApp payment rules
  const whatsappProduct = await prisma.backofficeProduct.findUnique({ where: { slug: "whatsapp" } })
  if (whatsappProduct) {
    for (const rule of WHATSAPP_PAYMENT_RULES) {
      await prisma.backofficeProductPaymentRule.upsert({
        where: {
          productId_paymentMethod_billingCycle: {
            productId: whatsappProduct.id,
            paymentMethod: rule.paymentMethod,
            billingCycle: rule.billingCycle,
          },
        },
        create: { productId: whatsappProduct.id, ...rule },
        update: { price: rule.price, canInstallment: rule.canInstallment, maxInstallments: rule.maxInstallments },
      })
    }
    console.info("[seed:backoffice-products] Regras de pagamento WhatsApp prontas")
  }

  const cdpProduct = await prisma.backofficeProduct.findUnique({ where: { slug: "cdp" } })
  if (cdpProduct) {
    for (const rule of CDP_PAYMENT_RULES) {
      await prisma.backofficeProductPaymentRule.upsert({
        where: {
          productId_paymentMethod_billingCycle: {
            productId: cdpProduct.id,
            paymentMethod: rule.paymentMethod,
            billingCycle: rule.billingCycle,
          },
        },
        create: { productId: cdpProduct.id, ...rule },
        update: { price: rule.price, canInstallment: rule.canInstallment, maxInstallments: rule.maxInstallments },
      })
    }
    console.info("[seed:backoffice-products] Regras de pagamento CDP prontas")
  }

  console.info("[seed:backoffice-products] Concluído.")
}

main()
  .catch((e) => {
    console.error("[seed:backoffice-products] Falhou:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
