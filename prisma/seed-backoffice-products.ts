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
    featureSlugs: ["crm"],
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
    isDefault: true,
  },
  {
    featureSlugs: ["crm-lifetime"],
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
    isDefault: true,
  },
  {
    featureSlugs: ["extra-team"],
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
    isDefault: true,
  },
  {
    featureSlugs: ["extra-user"],
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
    isDefault: true,
  },
  {
    featureSlugs: ["email"],
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
    isDefault: true,
  },
  {
    featureSlugs: ["whatsapp"],
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
    isDefault: true,
  },
  {
    featureSlugs: ["radar"],
    name: "Radar",
    description: "Radar — perfis unificados, segmentos e timeline para campanhas de e-mail.",
    type: BackofficeProductType.ADDON,
    billingMode: BackofficeProductBillingMode.RECURRING,
    priceMonthly: 29.9,
    priceQuarterly: 29.9,
    priceSemiannual: 29.9,
    priceAnnual: 29.9,
    priceLifetime: null,
    isActive: true,
    isDefault: true,
  },
]

// Features sem parentSlug são guarda-chuvas. Features com parentSlug herdam acesso do pai por padrão.
const FEATURES_WITHOUT_PARENT_INHERITANCE = new Set([
  "crm-lead-transfers",
  "email-settings",
  "whatsapp-auto-responses",
])

function resolveInheritParentSettings(slug: string, parentSlug?: string): boolean {
  if (!parentSlug) return false
  return !FEATURES_WITHOUT_PARENT_INHERITANCE.has(slug)
}

function resolveBilledSeparately(parentSlug?: string, inheritParentSettings?: boolean): boolean {
  if (!parentSlug) return false
  return inheritParentSettings === false
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
  { slug: "crm-calendar",         name: "Calendário",         accessMode: BackofficeFeatureAccessMode.PAID, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: true, sortOrder: 40, parentSlug: "crm", productSlug: "crm" },
  { slug: "crm-performance",      name: "Performance",        accessMode: BackofficeFeatureAccessMode.PAID, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: true, sortOrder: 50, parentSlug: "crm", productSlug: "crm" },
  { slug: "crm-simulator",        name: "Simulador de Planos",accessMode: BackofficeFeatureAccessMode.PAID, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: true, sortOrder: 60, parentSlug: "crm", productSlug: "crm" },
  { slug: "crm-time",             name: "Time",               accessMode: BackofficeFeatureAccessMode.PAID, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: true, sortOrder: 70, parentSlug: "crm", productSlug: "crm" },
  { slug: "crm-time-manage-teams",name: "Gerenciar Times",    accessMode: BackofficeFeatureAccessMode.PAID, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: true, sortOrder: 80, parentSlug: "crm", productSlug: "extra-team" },
  { slug: "crm-time-manage-users",name: "Gerenciar Usuários", accessMode: BackofficeFeatureAccessMode.PAID, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: true, sortOrder: 90, parentSlug: "crm", productSlug: "extra-user" },
  { slug: "crm-wallet",           name: "Carteira",           accessMode: BackofficeFeatureAccessMode.PAID, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: true, sortOrder: 95, parentSlug: "crm", productSlug: "crm" },
  { slug: "crm-automations",      name: "Automações",         accessMode: BackofficeFeatureAccessMode.PAID, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: true, sortOrder: 96, parentSlug: "crm", productSlug: "crm" },

  // ── Email guarda-chuva ────────────────────────────────────────────────────
  { slug: "email",               name: "Email",     accessMode: BackofficeFeatureAccessMode.ADDON, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: true,  inheritParentSettings: false, sortOrder: 100, productSlug: "email" },
  { slug: "email-templates",     name: "Templates", accessMode: BackofficeFeatureAccessMode.ADDON, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: true, sortOrder: 110, parentSlug: "email", productSlug: "email" },
  { slug: "email-contacts",      name: "Contatos",  accessMode: BackofficeFeatureAccessMode.ADDON, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: true, sortOrder: 120, parentSlug: "email", productSlug: "email" },
  { slug: "email-campaigns",     name: "Campanhas", accessMode: BackofficeFeatureAccessMode.ADDON, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: true, sortOrder: 130, parentSlug: "email", productSlug: "email" },
  { slug: "email-history",       name: "Histórico", accessMode: BackofficeFeatureAccessMode.ADDON, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: true, sortOrder: 140, parentSlug: "email", productSlug: "email" },
  { slug: "email-analytics",     name: "Métricas",       accessMode: BackofficeFeatureAccessMode.ADDON, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: true, sortOrder: 150, parentSlug: "email", productSlug: "email" },
  { slug: "email-unsubscribe",   name: "Descadastro",    accessMode: BackofficeFeatureAccessMode.ADDON, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: true, sortOrder: 155, parentSlug: "email", productSlug: "email" },
  { slug: "email-settings",     name: "Configurações",  accessMode: BackofficeFeatureAccessMode.ADDON, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: false, sortOrder: 160, parentSlug: "email", productSlug: "email" },

  // ── WhatsApp guarda-chuva ─────────────────────────────────────────────────
  { slug: "whatsapp",                name: "WhatsApp",               accessMode: BackofficeFeatureAccessMode.ADDON, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: true,  inheritParentSettings: false, sortOrder: 170, productSlug: "whatsapp" },
  { slug: "whatsapp-auto-responses", name: "Auto-respostas",         accessMode: BackofficeFeatureAccessMode.ADDON, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: false, sortOrder: 172, parentSlug: "whatsapp", productSlug: "whatsapp" },
  { slug: "whatsapp-settings",       name: "Configurações WhatsApp", accessMode: BackofficeFeatureAccessMode.ADDON, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: true, sortOrder: 175, parentSlug: "whatsapp", productSlug: "whatsapp" },

  // ── Radar guarda-chuva ────────────────────────────────────────────────────
  { slug: "radar", name: "Radar", accessMode: BackofficeFeatureAccessMode.ADDON, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: true, inheritParentSettings: false, sortOrder: 180, productSlug: "radar" },

  { slug: "studio-bot", name: "Bethânia", accessMode: BackofficeFeatureAccessMode.ADDON, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: false, sortOrder: 185, productSlug: "crm" },
  { slug: "studio-bot-ops", name: "Ops / Host", accessMode: BackofficeFeatureAccessMode.ADDON, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: false, inheritParentSettings: false, sortOrder: 186, parentSlug: "studio-bot", productSlug: "crm" },
  { slug: "studio-bot-ai", name: "IA", accessMode: BackofficeFeatureAccessMode.ADDON, defaultAccessLevel: BackofficeFeatureAccessLevel.FULL, betaEnabled: true, inheritParentSettings: false, sortOrder: 187, parentSlug: "studio-bot", productSlug: "crm" },

  // ── Formulários públicos guarda-chuva ─────────────────────────────────────
  {
    slug: "public-forms",
    name: "Formulários públicos",
    accessMode: BackofficeFeatureAccessMode.PUBLIC,
    defaultAccessLevel: BackofficeFeatureAccessLevel.FULL,
    betaEnabled: true,
    inheritParentSettings: false,
    sortOrder: 190,
    productSlug: null,
  },
  {
    slug: "form-templates",
    name: "Templates de formulário",
    accessMode: BackofficeFeatureAccessMode.PUBLIC,
    defaultAccessLevel: BackofficeFeatureAccessLevel.FULL,
    betaEnabled: false,
    inheritParentSettings: false,
    sortOrder: 195,
    parentSlug: "integration",
    productSlug: null,
  },

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

const RADAR_PAYMENT_RULES: Array<{
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
  "crm-automations": completeRuleSet([
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
  "email-unsubscribe": completeRuleSet([
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
  radar: completeRuleSet([
    { principal: "MASTER", accessLevel: "FULL" },
    { principal: "MANAGER", accessLevel: "FULL" },
    { principal: "BACKOFFICE", accessLevel: "FULL" },
  ]),
  "studio-bot": completeRuleSet([
    { principal: "MASTER", accessLevel: "FULL" },
    { principal: "BACKOFFICE", accessLevel: "FULL" },
  ]),
  "studio-bot-ops": completeRuleSet([
    { principal: "MASTER", accessLevel: "FULL" },
    { principal: "BACKOFFICE", accessLevel: "FULL" },
  ]),
  "studio-bot-ai": completeRuleSet([
    { principal: "MASTER", accessLevel: "FULL" },
    { principal: "BACKOFFICE", accessLevel: "FULL" },
  ]),
  integration: completeRuleSet([{ principal: "MASTER", accessLevel: "FULL" }]),
  "public-forms": completeRuleSet([
    { principal: "MASTER", accessLevel: "FULL" },
    { principal: "MANAGER", accessLevel: "FULL" },
    { principal: "BACKOFFICE", accessLevel: "FULL" },
    { principal: "OPERATOR", accessLevel: "FULL" },
  ]),
  "form-templates": completeRuleSet([
    { principal: "MASTER", accessLevel: "FULL" },
    { principal: "MANAGER", accessLevel: "FULL" },
    { principal: "BACKOFFICE", accessLevel: "FULL" },
  ]),

}

async function main() {
  console.info("[seed:backoffice-products] Iniciando...")

  // 1. Upsert products (default variant per feature slug)
  for (const product of PRODUCTS) {
    const primarySlug = product.featureSlugs[0]
    const existing = await prisma.backofficeProduct.findFirst({
      where: { featureSlugs: { has: primarySlug }, isDefault: true, name: product.name },
    })

    const data = {
      featureSlugs: product.featureSlugs,
      name: product.name,
      description: product.description,
      type: product.type,
      billingMode: product.billingMode,
      priceMonthly: product.priceMonthly,
      priceQuarterly: product.priceQuarterly,
      priceSemiannual: product.priceSemiannual,
      priceAnnual: product.priceAnnual,
      priceLifetime: product.priceLifetime,
      isActive: product.isActive,
      isDefault: product.isDefault,
    }

    if (existing) {
      await prisma.backofficeProduct.update({
        where: { id: existing.id },
        data,
      })
    } else {
      await prisma.backofficeProduct.create({ data })
    }
    console.info(`[seed:backoffice-products] Produto pronto: ${product.featureSlugs.join(", ")}`)
  }

  // 2. Upsert features without parentId first (resolve parents in second pass)
  for (const feature of FEATURES) {
    const inheritParentSettings = feature.inheritParentSettings
    const betaEnabled = inheritParentSettings ? false : feature.betaEnabled
    const billedSeparately = resolveBilledSeparately(feature.parentSlug, inheritParentSettings)

    await prisma.backofficeFeature.upsert({
      where: { slug: feature.slug },
      create: {
        slug: feature.slug,
        name: feature.name,
        accessMode: feature.accessMode,
        defaultAccessLevel: feature.defaultAccessLevel,
        betaEnabled,
        inheritParentSettings,
        billedSeparately,
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
        billedSeparately,
        sortOrder: feature.sortOrder,
        productSlug: feature.productSlug,
        isActive: true,
      },
    })
    console.info(`[seed:backoffice-products] Feature pronta: ${feature.slug}`)
  }

  // 3. Set parentId for child features; clear parentId for top-level umbrellas
  for (const feature of FEATURES) {
    if (!feature.parentSlug) {
      await prisma.backofficeFeature.update({
        where: { slug: feature.slug },
        data: {
          parentId: null,
          inheritParentSettings: false,
          billedSeparately: false,
        },
      })
      console.info(`[seed:backoffice-products] parentId limpo (top-level): ${feature.slug}`)
      continue
    }

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
        billedSeparately: resolveBilledSeparately(
          feature.parentSlug,
          resolveInheritParentSettings(feature.slug, feature.parentSlug)
        ),
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
  const crmProduct = await prisma.backofficeProduct.findFirst({
    where: { featureSlugs: { has: "crm" }, isDefault: true },
  })
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
  const whatsappProduct = await prisma.backofficeProduct.findFirst({
    where: { featureSlugs: { has: "whatsapp" }, isDefault: true },
  })
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

  const radarProduct = await prisma.backofficeProduct.findFirst({
    where: { featureSlugs: { has: "radar" }, isDefault: true },
  })
  if (radarProduct) {
    for (const rule of RADAR_PAYMENT_RULES) {
      await prisma.backofficeProductPaymentRule.upsert({
        where: {
          productId_paymentMethod_billingCycle: {
            productId: radarProduct.id,
            paymentMethod: rule.paymentMethod,
            billingCycle: rule.billingCycle,
          },
        },
        create: { productId: radarProduct.id, ...rule },
        update: { price: rule.price, canInstallment: rule.canInstallment, maxInstallments: rule.maxInstallments },
      })
    }
    console.info("[seed:backoffice-products] Regras de pagamento Radar prontas")
  }

  // 8. CRM - Radar (precificação trimestral CUSTOM, não default)
  const crmRadarData = {
    featureSlugs: ["crm", "radar"],
    name: "CRM - Radar",
    description:
      "Precificação trimestral CRM para Radar — à vista ou cronograma 1x R$1.200 + 2x R$990.",
    type: BackofficeProductType.PLAN,
    billingMode: BackofficeProductBillingMode.RECURRING,
    priceMonthly: null as number | null,
    priceQuarterly: 1060,
    priceSemiannual: null as number | null,
    priceAnnual: null as number | null,
    priceLifetime: null as number | null,
    isActive: true,
    isDefault: false,
  }
  let crmRadarProduct = await prisma.backofficeProduct.findFirst({
    where: { name: "CRM - Radar" },
  })
  if (crmRadarProduct) {
    crmRadarProduct = await prisma.backofficeProduct.update({
      where: { id: crmRadarProduct.id },
      data: crmRadarData,
    })
  } else {
    crmRadarProduct = await prisma.backofficeProduct.create({ data: crmRadarData })
  }
  await prisma.backofficeProductPaymentRule.upsert({
    where: {
      productId_paymentMethod_billingCycle: {
        productId: crmRadarProduct.id,
        paymentMethod: BackofficePaymentMethod.PIX,
        billingCycle: BackofficeAdhesionBillingCycle.quarterly,
      },
    },
    create: {
      productId: crmRadarProduct.id,
      paymentMethod: BackofficePaymentMethod.PIX,
      billingCycle: BackofficeAdhesionBillingCycle.quarterly,
      price: 1060,
      canInstallment: false,
      maxInstallments: 1,
      installmentSplitMode: "EQUAL",
      installmentSchedule: [],
    },
    update: {
      price: 1060,
      canInstallment: false,
      maxInstallments: 1,
      installmentSplitMode: "EQUAL",
      installmentSchedule: [],
    },
  })
  await prisma.backofficeProductPaymentRule.upsert({
    where: {
      productId_paymentMethod_billingCycle: {
        productId: crmRadarProduct.id,
        paymentMethod: BackofficePaymentMethod.CREDIT_CARD,
        billingCycle: BackofficeAdhesionBillingCycle.quarterly,
      },
    },
    create: {
      productId: crmRadarProduct.id,
      paymentMethod: BackofficePaymentMethod.CREDIT_CARD,
      billingCycle: BackofficeAdhesionBillingCycle.quarterly,
      price: 3180,
      canInstallment: true,
      maxInstallments: 3,
      installmentSplitMode: "CUSTOM",
      installmentSchedule: [1200, 990, 990],
    },
    update: {
      price: 3180,
      canInstallment: true,
      maxInstallments: 3,
      installmentSplitMode: "CUSTOM",
      installmentSchedule: [1200, 990, 990],
    },
  })
  console.info("[seed:backoffice-products] Precificação CRM - Radar pronta")

  // 9. CRM - RADAR - GERENCIADO (quadrimestral EQUAL, cobrança única de R$ 10.000, não default)
  const crmRadarGerenciadoData = {
    featureSlugs: ["crm", "radar", "email", "public-forms"],
    name: "CRM - RADAR - GERENCIADO",
    description:
      "Plano gerenciado quadrimestral — R$ 10.000 em cobrança única (cartão em até 4x iguais); libera CRM, Radar, E-mails e Formulários.",
    type: BackofficeProductType.PLAN,
    billingMode: BackofficeProductBillingMode.RECURRING,
    priceMonthly: null as number | null,
    priceQuarterly: null as number | null,
    priceQuadrimester: 2500,
    priceSemiannual: null as number | null,
    priceAnnual: null as number | null,
    priceLifetime: null as number | null,
    isActive: true,
    isDefault: false,
  }
  let crmRadarGerenciadoProduct = await prisma.backofficeProduct.findFirst({
    where: { name: "CRM - RADAR - GERENCIADO" },
  })
  if (crmRadarGerenciadoProduct) {
    crmRadarGerenciadoProduct = await prisma.backofficeProduct.update({
      where: { id: crmRadarGerenciadoProduct.id },
      data: crmRadarGerenciadoData,
    })
  } else {
    crmRadarGerenciadoProduct = await prisma.backofficeProduct.create({
      data: crmRadarGerenciadoData,
    })
  }
  await prisma.backofficeProductPaymentRule.upsert({
    where: {
      productId_paymentMethod_billingCycle: {
        productId: crmRadarGerenciadoProduct.id,
        paymentMethod: BackofficePaymentMethod.PIX,
        billingCycle: BackofficeAdhesionBillingCycle.quadrimester,
      },
    },
    create: {
      productId: crmRadarGerenciadoProduct.id,
      paymentMethod: BackofficePaymentMethod.PIX,
      billingCycle: BackofficeAdhesionBillingCycle.quadrimester,
      price: 2500,
      canInstallment: false,
      maxInstallments: 1,
      installmentSplitMode: "EQUAL",
      installmentSchedule: [],
    },
    update: {
      price: 2500,
      canInstallment: false,
      maxInstallments: 1,
      installmentSplitMode: "EQUAL",
      installmentSchedule: [],
    },
  })
  await prisma.backofficeProductPaymentRule.upsert({
    where: {
      productId_paymentMethod_billingCycle: {
        productId: crmRadarGerenciadoProduct.id,
        paymentMethod: BackofficePaymentMethod.CREDIT_CARD,
        billingCycle: BackofficeAdhesionBillingCycle.quadrimester,
      },
    },
    create: {
      productId: crmRadarGerenciadoProduct.id,
      paymentMethod: BackofficePaymentMethod.CREDIT_CARD,
      billingCycle: BackofficeAdhesionBillingCycle.quadrimester,
      price: 2500,
      canInstallment: true,
      maxInstallments: 4,
      installmentSplitMode: "EQUAL",
      installmentSchedule: [],
    },
    update: {
      price: 2500,
      canInstallment: true,
      maxInstallments: 4,
      installmentSplitMode: "EQUAL",
      installmentSchedule: [],
    },
  })
  console.info("[seed:backoffice-products] Precificação CRM - RADAR - GERENCIADO pronta")

  console.info("[seed:backoffice-products] Concluído.")
}

main()
  .catch((e) => {
    console.error("[seed:backoffice-products] Falhou:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
