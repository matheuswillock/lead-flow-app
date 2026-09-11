import { backofficeShortLinkService } from "@/app/api/services/backoffice/backofficeShortLink/BackofficeShortLinkService"
import { Output } from "@/lib/output"
import { getFullUrl } from "@/lib/utils/app-url"
import { normalizePhone } from "@/lib/whatsapp/normalize-phone"
import {
  generateOfferShareToken,
  getOfferShareExpiry,
  hashOfferShareToken,
  isOfferShareExpired,
} from "@/lib/backoffice-offers/offer-share-token"
import { BackofficeLeadRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeLead/BackofficeLeadRepository"
import type { IBackofficeLeadRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeLead/IBackofficeLeadRepository"
import { BackofficeProductRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeProduct/BackofficeProductRepository"
import type { IBackofficeProductRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeProduct/IBackofficeProductRepository"
import { BackofficeLeadOfferRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeLeadOffer/BackofficeLeadOfferRepository"
import type {
  BackofficeLeadOfferItemSnapshot,
  BackofficeLeadOfferRecord,
  IBackofficeLeadOfferRepository,
} from "@/app/api/infra/data/repositories/backoffice/backofficeLeadOffer/IBackofficeLeadOfferRepository"
import type { Prisma } from "@prisma/client"

export type CreateLeadOfferInput = {
  productIds: string[]
  contactName: string
  contactPhone: string
  preContractExpiresAt: string
  insuranceAmount?: number | null
}

export type BackofficeLeadOfferListStatus = "active" | "expired" | "revoked"

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === "number") return value
  return Number(value)
}

function parseItemsJson(value: Prisma.JsonValue): BackofficeLeadOfferItemSnapshot[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is BackofficeLeadOfferItemSnapshot => {
    if (!item || typeof item !== "object") return false
    const record = item as Record<string, unknown>
    return typeof record.productId === "string" && typeof record.name === "string"
  })
}

function deriveOfferStatus(
  offer: BackofficeLeadOfferRecord,
  now: Date = new Date()
): BackofficeLeadOfferListStatus {
  if (offer.revokedAt) return "revoked"
  if (isOfferShareExpired(offer.shareExpiresAt, now)) return "expired"
  return "active"
}

async function mapListItem(offer: BackofficeLeadOfferRecord) {
  const items = parseItemsJson(offer.itemsJson)
  const status = deriveOfferStatus(offer)
  const offerTargetUrl =
    status === "active" && offer.tokenPlain
      ? getFullUrl(`/oferta/${offer.tokenPlain}`)
      : null
  const shareUrl = offerTargetUrl
    ? await backofficeShortLinkService.getOrCreate({ targetUrl: offerTargetUrl, expiresAt: offer.shareExpiresAt })
    : null

  return {
    id: offer.id,
    status,
    expiresAt: offer.shareExpiresAt.toISOString(),
    generatedAt: offer.shareGeneratedAt.toISOString(),
    revokedAt: offer.revokedAt?.toISOString() ?? null,
    contactName: offer.contactName,
    contactPhone: offer.contactPhone,
    productNames: items.map((item) => item.name),
    preContractExpiresAt: offer.preContractExpiresAt.toISOString(),
    insuranceAmount: decimalToNumber(offer.insuranceAmount),
    shareUrl,
  }
}

function parsePreContractExpiresAt(value: string): { isValid: true; date: Date } | { isValid: false; error: string } {
  if (!value?.trim()) {
    return { isValid: false, error: "Data de vencimento do pré-contrato é obrigatória" }
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return { isValid: false, error: "Data de vencimento do pré-contrato é inválida" }
  }
  if (date.getTime() <= Date.now()) {
    return { isValid: false, error: "Data de vencimento do pré-contrato deve ser futura" }
  }
  return { isValid: true, date }
}

function parseInsuranceAmount(
  value: number | null | undefined
): { isValid: true; amount: number | null } | { isValid: false; error: string } {
  if (value === null || value === undefined) {
    return { isValid: true, amount: null }
  }
  if (typeof value !== "number" || Number.isNaN(value)) {
    return { isValid: false, error: "Valor do seguro é inválido" }
  }
  if (value < 0) {
    return { isValid: false, error: "Valor do seguro deve ser maior ou igual a zero" }
  }
  return { isValid: true, amount: value }
}

export class BackofficeLeadOfferUseCase {
  constructor(
    private readonly offerRepository: IBackofficeLeadOfferRepository,
    private readonly leadRepository: IBackofficeLeadRepository,
    private readonly productRepository: IBackofficeProductRepository
  ) {}

  async createOffer(leadId: string, profileId: string, input: CreateLeadOfferInput): Promise<Output> {
    const lead = await this.leadRepository.findById(leadId)
    if (!lead) {
      return new Output(false, [], ["Lead não encontrado"], null)
    }

    const productIds = Array.isArray(input.productIds)
      ? [...new Set(input.productIds.filter((id) => typeof id === "string" && id.trim()))]
      : []
    if (productIds.length === 0) {
      return new Output(false, [], ["Selecione ao menos um produto"], null)
    }

    const contactName = input.contactName?.trim() ?? ""
    if (!contactName) {
      return new Output(false, [], ["Nome do contato do CTA é obrigatório"], null)
    }

    const contactPhone = normalizePhone(input.contactPhone?.trim() ?? "")
    if (!contactPhone || contactPhone.length < 12) {
      return new Output(false, [], ["Telefone do contato do CTA é inválido"], null)
    }

    const preContract = parsePreContractExpiresAt(input.preContractExpiresAt)
    if (!preContract.isValid) {
      return new Output(false, [], [preContract.error], null)
    }

    const insurance = parseInsuranceAmount(input.insuranceAmount)
    if (!insurance.isValid) {
      return new Output(false, [], [insurance.error], null)
    }

    const allProducts = await this.productRepository.findAll()
    const selectedProducts = allProducts.filter(
      (product) => productIds.includes(product.id) && product.isActive
    )
    if (selectedProducts.length !== productIds.length) {
      return new Output(false, [], ["Um ou mais produtos selecionados são inválidos ou inativos"], null)
    }

    const itemsJson: BackofficeLeadOfferItemSnapshot[] = selectedProducts.map((product) => ({
      productId: product.id,
      name: product.name,
      description: product.description,
      type: product.type,
      priceMonthly: decimalToNumber(product.priceMonthly),
      priceQuarterly: decimalToNumber(product.priceQuarterly),
      priceQuadrimester: decimalToNumber(product.priceQuadrimester),
      priceSemiannual: decimalToNumber(product.priceSemiannual),
      priceAnnual: decimalToNumber(product.priceAnnual),
      priceLifetime: decimalToNumber(product.priceLifetime),
    }))

    const rawToken = generateOfferShareToken()
    const shareExpiresAt = getOfferShareExpiry()

    try {
      const revokedAt = new Date()
      await this.offerRepository.revokeActiveByLeadId(leadId, revokedAt)

      const offer = await this.offerRepository.create({
        leadId,
        leadNameSnapshot: lead.name,
        contactName,
        contactPhone,
        itemsJson,
        preContractExpiresAt: preContract.date,
        insuranceAmount: insurance.amount,
        shareTokenHash: hashOfferShareToken(rawToken),
        tokenPlain: rawToken,
        shareExpiresAt,
        shareGeneratedByProfileId: profileId,
      })

      const shareUrl = await backofficeShortLinkService.getOrCreate({
        targetUrl: getFullUrl(`/oferta/${rawToken}`),
        expiresAt: shareExpiresAt,
      })

      return new Output(true, ["Oferta gerada com sucesso"], [], {
        offerId: offer.id,
        shareUrl,
        expiresAt: shareExpiresAt.toISOString(),
        preContractExpiresAt: preContract.date.toISOString(),
      })
    } catch (error) {
      console.error("[BackofficeLeadOfferUseCase][createOffer] Erro ao gerar oferta:", error)
      return new Output(false, [], ["Erro inesperado ao gerar a oferta"], null)
    }
  }

  async listOffers(leadId: string): Promise<Output> {
    const lead = await this.leadRepository.findById(leadId)
    if (!lead) {
      return new Output(false, [], ["Lead não encontrado"], null)
    }

    try {
      const offers = await this.offerRepository.findByLeadId(leadId)
      return new Output(true, [], [], {
        offers: await Promise.all(offers.map(mapListItem)),
      })
    } catch (error) {
      console.error("[BackofficeLeadOfferUseCase][listOffers] Erro ao listar ofertas:", error)
      return new Output(false, [], ["Erro inesperado ao listar as ofertas"], null)
    }
  }

  async revokeOffer(leadId: string, offerId: string): Promise<Output> {
    const offer = await this.offerRepository.findById(offerId)
    if (!offer || offer.leadId !== leadId) {
      return new Output(false, [], ["Oferta não encontrada"], null)
    }

    if (offer.revokedAt || isOfferShareExpired(offer.shareExpiresAt)) {
      return new Output(true, ["Oferta já estava indisponível"], [], await mapListItem(offer))
    }

    try {
      const revokedAt = new Date()
      await this.offerRepository.revoke(offerId, revokedAt)
      return new Output(true, ["Link da oferta revogado com sucesso"], [], {
        ...(await mapListItem({ ...offer, revokedAt, shareExpiresAt: revokedAt, tokenPlain: null })),
      })
    } catch (error) {
      console.error("[BackofficeLeadOfferUseCase][revokeOffer] Erro ao revogar a oferta:", error)
      return new Output(false, [], ["Erro inesperado ao revogar a oferta"], null)
    }
  }

  async resolvePublicOffer(token: string): Promise<Output> {
    if (!token?.trim()) {
      return new Output(false, [], ["Link inválido"], null)
    }

    const offer = await this.offerRepository.findByShareTokenHash(hashOfferShareToken(token))
    if (!offer) {
      return new Output(false, [], ["Link inválido"], null)
    }

    const contact = {
      contactName: offer.contactName,
      contactPhone: offer.contactPhone,
    }

    const preContract = {
      preContractExpiresAt: offer.preContractExpiresAt.toISOString(),
      insuranceAmount: decimalToNumber(offer.insuranceAmount),
    }

    if (isOfferShareExpired(offer.shareExpiresAt)) {
      return new Output(true, [], [], {
        status: "expired" as const,
        leadName: offer.leadNameSnapshot,
        ...contact,
        ...preContract,
      })
    }

    return new Output(true, [], [], {
      status: "active" as const,
      leadName: offer.leadNameSnapshot,
      items: parseItemsJson(offer.itemsJson),
      expiresAt: offer.shareExpiresAt.toISOString(),
      ...contact,
      ...preContract,
    })
  }
}

export const backofficeLeadOfferUseCase = new BackofficeLeadOfferUseCase(
  new BackofficeLeadOfferRepository(),
  new BackofficeLeadRepository(),
  new BackofficeProductRepository()
)
