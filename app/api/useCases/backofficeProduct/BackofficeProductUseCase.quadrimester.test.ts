import { describe, expect, it } from "bun:test"
import type { IBackofficeFeatureRepository } from "../../infra/data/repositories/backoffice/backofficeFeature/IBackofficeFeatureRepository"
import type {
  CreateBackofficeProductInput,
  IBackofficeProductRepository,
} from "../../infra/data/repositories/backoffice/backofficeProduct/IBackofficeProductRepository"
import { BackofficeProductUseCase } from "./BackofficeProductUseCase"

const GERENCIADO_SLUGS = ["crm", "radar", "email", "public-forms"]

function buildRepos() {
  const created: Array<CreateBackofficeProductInput & { priceQuadrimester?: number | null }> = []
  const upsertedRules: Array<{ productId: string; rules: unknown[] }> = []

  const productRepo = {
    findAll: async () => [],
    findAllWithPaymentRules: async () => [],
    findById: async () => null,
    findByIdWithPaymentRules: async () => null,
    findByFeatureSlug: async () => [],
    findByFeatureSlugWithPaymentRules: async () => [],
    findDefaultByFeatureSlug: async () => null,
    findDefaultByFeatureSlugWithPaymentRules: async () => null,
    countByFeatureSlug: async () => 1,
    create: async (data: CreateBackofficeProductInput) => {
      created.push(data as never)
      return {
        id: "prod-gerenciado",
        createdAt: new Date("2026-08-31T12:00:00Z"),
        updatedAt: new Date("2026-08-31T12:00:00Z"),
        paymentRules: [],
        ...data,
      } as never
    },
    update: async () => {
      throw new Error("não usado neste teste")
    },
    clearDefaultForFeatureSlug: async () => {},
    upsertPaymentRules: async (productId: string, rules: unknown[]) => {
      upsertedRules.push({ productId, rules })
    },
    replacePaymentRules: async () => {},
    findLockedBillingCycles: async () => new Set<never>(),
    delete: async () => {},
  } as unknown as IBackofficeProductRepository

  const featureRepo = {
    findBySlug: async (slug: string) => (GERENCIADO_SLUGS.includes(slug) ? { id: `feat-${slug}`, slug } : null),
  } as unknown as IBackofficeFeatureRepository

  return { productRepo, featureRepo, created, upsertedRules }
}

describe("BackofficeProductUseCase.create — ciclo quadrimestral", () => {
  it("cria a precificação GERENCIADO com priceQuadrimester e regras quadrimester", async () => {
    const { productRepo, featureRepo, created, upsertedRules } = buildRepos()
    const useCase = new BackofficeProductUseCase(productRepo, featureRepo)

    const output = await useCase.create({
      name: "CRM - RADAR - GERENCIADO",
      featureSlugs: GERENCIADO_SLUGS,
      description: "Plano gerenciado quadrimestral",
      type: "PLAN",
      billingMode: "RECURRING",
      priceQuadrimester: 2500,
      paymentRules: [
        {
          paymentMethod: "PIX",
          billingCycle: "quadrimester",
          price: 2500,
          canInstallment: false,
          maxInstallments: 1,
          installmentSplitMode: "EQUAL",
          installmentSchedule: [],
        },
        {
          paymentMethod: "CREDIT_CARD",
          billingCycle: "quadrimester",
          price: 2500,
          canInstallment: true,
          maxInstallments: 4,
          installmentSplitMode: "EQUAL",
          installmentSchedule: [],
        },
      ],
      isDefault: false,
      isActive: true,
    } as never)

    expect(output.isValid).toBe(true)
    expect(created).toHaveLength(1)
    expect(created[0]?.priceQuadrimester).toBe(2500)
    expect(created[0]?.featureSlugs).toEqual(GERENCIADO_SLUGS)
    expect(created[0]?.isDefault).toBe(false)

    expect(upsertedRules).toHaveLength(1)
    const cycles = (upsertedRules[0]?.rules as Array<{ billingCycle: string; maxInstallments: number }>).map(
      (rule) => `${rule.billingCycle}:${rule.maxInstallments}`
    )
    expect(cycles).toContain("quadrimester:1")
    expect(cycles).toContain("quadrimester:4")
  })
})
