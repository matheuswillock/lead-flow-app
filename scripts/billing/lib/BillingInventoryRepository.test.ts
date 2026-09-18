/**
 * Trava do escopo por conta do inventário (30-E1 + refinamento de 30-E3).
 *
 * Os fakes de Prisma aqui NÃO devolvem lista fixa: eles aplicam o `where`
 * recebido sobre as fixtures, como o banco faria. É de propósito — um teste
 * que só afirma o formato do `where` continua verde se o filtro for trocado
 * por outro igualmente bem formado, e era exatamente esse o risco desta
 * mudança (ver `listSubscriptionPointers`).
 */

import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { AsaasAccountId } from "@/lib/asaas/asaas-account"

type ClientRow = {
  id: string
  email: string | null
  asaasCustomerId: string | null
  asaasAccount: AsaasAccountId
}

type CustomerProfileRow = {
  id: string
  email: string
  asaasCustomerId: string | null
  asaasCustomerAccount: AsaasAccountId
}

type SubscriptionProfileRow = {
  id: string
  asaasSubscriptionId: string | null
  asaasSubscriptionAccount: AsaasAccountId
  subscriptionStatus: string | null
  subscriptionEndDate: Date | null
  /** null = sem linha de ProfileSubscription (dispara o fallback legado) */
  subscription: { asaasSubscriptionId: string | null } | null
}

type SubscriptionRow = {
  id: string
  profileId: string
  asaasSubscriptionId: string | null
  subscriptionStatus: string | null
  subscriptionEndDate: Date | null
  /** coluna própria, entregue por 30-E3 — hoje sem writer, sempre 'primary' */
  asaasSubscriptionAccount: AsaasAccountId
  /** dono real da conta hoje */
  profile: { asaasSubscriptionAccount: AsaasAccountId }
}

let clientRows: ClientRow[] = []
let customerProfileRows: CustomerProfileRow[] = []
let subscriptionProfileRows: SubscriptionProfileRow[] = []
let subscriptionRows: SubscriptionRow[] = []

const backofficeClientFindMany = mock(async (args: { where: Record<string, unknown> }) => {
  const account = args.where.asaasAccount as AsaasAccountId | undefined
  return clientRows.filter(
    (row) => row.asaasCustomerId !== null && (account === undefined || row.asaasAccount === account)
  )
})

const backofficeAdhesionFindMany = mock(async () => [])

const profileFindMany = mock(async (args: { where: Record<string, unknown> }) => {
  // Mesmo model, dois `where` distintos: ponteiro de customer em
  // listCustomerPointers e fallback legado em listSubscriptionPointers.
  if ("asaasSubscriptionId" in args.where) {
    const account = args.where.asaasSubscriptionAccount as AsaasAccountId | undefined
    return subscriptionProfileRows.filter(
      (row) =>
        row.asaasSubscriptionId !== null &&
        (account === undefined || row.asaasSubscriptionAccount === account) &&
        (row.subscription === null || row.subscription.asaasSubscriptionId === null)
    )
  }

  const account = args.where.asaasCustomerAccount as AsaasAccountId | undefined
  return customerProfileRows.filter(
    (row) =>
      row.asaasCustomerId !== null && (account === undefined || row.asaasCustomerAccount === account)
  )
})

const profileSubscriptionFindMany = mock(async (args: { where: Record<string, unknown> }) => {
  const viaRelation = (args.where.profile as { asaasSubscriptionAccount?: AsaasAccountId } | undefined)
    ?.asaasSubscriptionAccount
  const viaOwnColumn = args.where.asaasSubscriptionAccount as AsaasAccountId | undefined

  return subscriptionRows.filter(
    (row) =>
      row.asaasSubscriptionId !== null &&
      (viaRelation === undefined || row.profile.asaasSubscriptionAccount === viaRelation) &&
      (viaOwnColumn === undefined || row.asaasSubscriptionAccount === viaOwnColumn)
  )
})

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    profile: { findMany: profileFindMany },
    backofficeAdhesion: { findMany: backofficeAdhesionFindMany },
    backofficeClient: { findMany: backofficeClientFindMany },
    profileSubscription: { findMany: profileSubscriptionFindMany },
  },
}))

const { BillingInventoryRepository } = await import("./BillingInventoryRepository")

describe("BillingInventoryRepository — escopo por conta", () => {
  beforeEach(() => {
    backofficeClientFindMany.mockClear()
    backofficeAdhesionFindMany.mockClear()
    profileFindMany.mockClear()
    profileSubscriptionFindMany.mockClear()

    clientRows = [
      {
        id: "client-primary",
        email: "primary@example.com",
        asaasCustomerId: "cus_primary",
        asaasAccount: "primary",
      },
      {
        id: "client-legacy",
        email: "legacy@example.com",
        asaasCustomerId: "cus_legacy",
        asaasAccount: "legacy",
      },
    ]
    customerProfileRows = []
    subscriptionProfileRows = []
    subscriptionRows = []
  })

  describe("listCustomerPointers", () => {
    it("filtra BackofficeClient por asaasAccount (coluna entregue em 30-E3)", async () => {
      const repo = new BillingInventoryRepository()

      const pointers = await repo.listCustomerPointers("primary")

      expect(backofficeClientFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { asaasCustomerId: { not: null }, asaasAccount: "primary" },
        })
      )
      expect(pointers.map((p) => p.refId)).toEqual(["client-primary"])
    })

    it("cliente da outra conta fica de fora — sem isso ele viraria ORFAO falso no cron de E7", async () => {
      const repo = new BillingInventoryRepository()

      const pointers = await repo.listCustomerPointers("legacy")

      expect(pointers).toHaveLength(1)
      expect(pointers[0]).toEqual({
        refId: "client-legacy",
        source: "backofficeClient",
        asaasCustomerId: "cus_legacy",
        email: "legacy@example.com",
      })
    })

    it("as três origens de customer filtram pela mesma conta", async () => {
      customerProfileRows = [
        {
          id: "profile-legacy",
          email: "p@example.com",
          asaasCustomerId: "cus_p",
          asaasCustomerAccount: "legacy",
        },
      ]
      const repo = new BillingInventoryRepository()

      await repo.listCustomerPointers("legacy")

      expect(profileFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { asaasCustomerId: { not: null }, asaasCustomerAccount: "legacy" },
        })
      )
      expect(backofficeAdhesionFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { asaasCustomerId: { not: null }, asaasAccount: "legacy" },
        })
      )
      expect(backofficeClientFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { asaasCustomerId: { not: null }, asaasAccount: "legacy" },
        })
      )
    })
  })

  describe("listSubscriptionPointers", () => {
    it("continua escopando pelo Profile, não pela coluna própria sem writer", async () => {
      // Cenário que o banco produz hoje: a coluna de 30-E3 nasceu com
      // `default 'primary'` e ninguém a escreve, enquanto o Profile já foi
      // movido para legacy. Filtrar pela coluna própria perderia esta linha.
      subscriptionRows = [
        {
          id: "ps-1",
          profileId: "profile-1",
          asaasSubscriptionId: "sub_1",
          subscriptionStatus: "active",
          subscriptionEndDate: null,
          asaasSubscriptionAccount: "primary",
          profile: { asaasSubscriptionAccount: "legacy" },
        },
      ]
      const repo = new BillingInventoryRepository()

      const pointers = await repo.listSubscriptionPointers("legacy")

      expect(pointers.map((p) => p.asaasSubscriptionId)).toEqual(["sub_1"])
      expect(profileSubscriptionFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            asaasSubscriptionId: { not: null },
            profile: { asaasSubscriptionAccount: "legacy" },
          },
        })
      )
    })

    it("assinatura de profile de outra conta não entra no inventário", async () => {
      subscriptionRows = [
        {
          id: "ps-primary",
          profileId: "profile-1",
          asaasSubscriptionId: "sub_primary",
          subscriptionStatus: "active",
          subscriptionEndDate: null,
          asaasSubscriptionAccount: "primary",
          profile: { asaasSubscriptionAccount: "primary" },
        },
      ]
      const repo = new BillingInventoryRepository()

      const pointers = await repo.listSubscriptionPointers("legacy")

      expect(pointers).toEqual([])
    })

    it("fallback legado de Profile também é escopado por conta", async () => {
      subscriptionProfileRows = [
        {
          id: "profile-fallback",
          asaasSubscriptionId: "sub_fallback",
          asaasSubscriptionAccount: "legacy",
          subscriptionStatus: "active",
          subscriptionEndDate: null,
          subscription: null,
        },
        {
          id: "profile-outra-conta",
          asaasSubscriptionId: "sub_outra",
          asaasSubscriptionAccount: "primary",
          subscriptionStatus: "active",
          subscriptionEndDate: null,
          subscription: null,
        },
      ]
      const repo = new BillingInventoryRepository()

      const pointers = await repo.listSubscriptionPointers("legacy")

      expect(pointers.map((p) => p.refId)).toEqual(["profile-fallback"])
      expect(pointers[0]?.source).toBe("profileFallback")
    })
  })
})
