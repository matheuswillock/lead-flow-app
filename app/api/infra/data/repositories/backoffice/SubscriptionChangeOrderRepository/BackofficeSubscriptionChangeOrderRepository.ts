import { prisma } from "@/app/api/infra/data/prisma"
import type { AsaasAccount, Prisma } from "@prisma/client"
import { toBillingCycle } from "@/lib/billing/resolvePrice"
import type {
  AttachSubscriptionChangeOrderPaymentData,
  BackofficeSubscriptionChangeOrderRecord,
  ChangeOrderMasterContext,
  ChangeOrderTargetProduct,
  CreateBackofficeSubscriptionChangeOrderData,
  IBackofficeSubscriptionChangeOrderRepository,
} from "./IBackofficeSubscriptionChangeOrderRepository"

const CHANGE_ORDER_SELECT = {
  id: true,
  masterProfileId: true,
  status: true,
  targetProductId: true,
  targetProduct: { select: { name: true } },
  targetCycle: true,
  listAmount: true,
  proratedAmount: true,
  overrideAmount: true,
  overrideStatus: true,
  overrideApprovedByProfileId: true,
  chargeAmount: true,
  asaasPaymentId: true,
  asaasAccount: true,
  paymentInvoiceUrl: true,
  createdAt: true,
} satisfies Prisma.BackofficeSubscriptionChangeOrderSelect

type ChangeOrderQueryResult = Prisma.BackofficeSubscriptionChangeOrderGetPayload<{
  select: typeof CHANGE_ORDER_SELECT
}>

function decimalToNumber(value: { toString(): string } | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return Number(value.toString())
}

function mapRecord(order: ChangeOrderQueryResult): BackofficeSubscriptionChangeOrderRecord {
  return {
    id: order.id,
    masterProfileId: order.masterProfileId,
    status: order.status as BackofficeSubscriptionChangeOrderRecord["status"],
    targetProductId: order.targetProductId,
    targetProductName: order.targetProduct.name,
    targetCycle: order.targetCycle,
    listAmount: Number(order.listAmount.toString()),
    proratedAmount: Number(order.proratedAmount.toString()),
    overrideAmount: decimalToNumber(order.overrideAmount),
    overrideStatus: order.overrideStatus as BackofficeSubscriptionChangeOrderRecord["overrideStatus"],
    overrideApprovedByProfileId: order.overrideApprovedByProfileId,
    chargeAmount: Number(order.chargeAmount.toString()),
    asaasPaymentId: order.asaasPaymentId,
    asaasAccount: order.asaasAccount,
    paymentInvoiceUrl: order.paymentInvoiceUrl,
    createdAt: order.createdAt,
  }
}

export class BackofficeSubscriptionChangeOrderRepository implements IBackofficeSubscriptionChangeOrderRepository {
  async findMasterContext(masterProfileId: string): Promise<ChangeOrderMasterContext | null> {
    const master = await prisma.profile.findFirst({
      where: { id: masterProfileId, isMaster: true, role: "manager" },
      select: {
        id: true,
        fullName: true,
        email: true,
        cpfCnpj: true,
        phone: true,
        postalCode: true,
        address: true,
        addressNumber: true,
        neighborhood: true,
        complement: true,
        asaasCustomerId: true,
        asaasCustomerAccount: true,
        hasPermanentSubscription: true,
        subscription: {
          select: {
            productId: true,
            subscriptionCycle: true,
            subscriptionNextDueDate: true,
            adhesion: { select: { cycle: true, totalAmount: true, negotiatedTotalAmount: true } },
          },
        },
      },
    })

    if (!master) return null

    const subscription = master.subscription
    const currentCycle =
      subscription?.adhesion?.cycle ?? toBillingCycle(subscription?.subscriptionCycle ?? "") ?? null
    const currentChargedAmount = subscription?.adhesion
      ? decimalToNumber(subscription.adhesion.negotiatedTotalAmount ?? subscription.adhesion.totalAmount)
      : null

    return {
      hasPermanentSubscription: master.hasPermanentSubscription,
      currentProductId: subscription?.productId ?? null,
      currentCycle,
      currentChargedAmount,
      currentPeriodEnd: subscription?.subscriptionNextDueDate ?? null,
      billingProfile: {
        id: master.id,
        fullName: master.fullName,
        email: master.email,
        cpfCnpj: master.cpfCnpj,
        phone: master.phone,
        postalCode: master.postalCode,
        address: master.address,
        addressNumber: master.addressNumber,
        neighborhood: master.neighborhood,
        complement: master.complement,
        asaasCustomerId: master.asaasCustomerId,
        asaasCustomerAccount: master.asaasCustomerAccount,
      },
    }
  }

  async findTargetProduct(productId: string): Promise<ChangeOrderTargetProduct | null> {
    const product = await prisma.backofficeProduct.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        isActive: true,
        priceMonthly: true,
        priceQuarterly: true,
        priceQuadrimester: true,
        priceSemiannual: true,
        priceAnnual: true,
      },
    })

    if (!product) return null

    return {
      id: product.id,
      name: product.name,
      isActive: product.isActive,
      priceMonthly: decimalToNumber(product.priceMonthly),
      priceQuarterly: decimalToNumber(product.priceQuarterly),
      priceQuadrimester: decimalToNumber(product.priceQuadrimester),
      priceSemiannual: decimalToNumber(product.priceSemiannual),
      priceAnnual: decimalToNumber(product.priceAnnual),
    }
  }

  async create(
    data: CreateBackofficeSubscriptionChangeOrderData
  ): Promise<BackofficeSubscriptionChangeOrderRecord> {
    const created = await prisma.backofficeSubscriptionChangeOrder.create({
      data: {
        masterProfileId: data.masterProfileId,
        status: "draft",
        currentProductId: data.currentProductId,
        currentCycle: data.currentCycle ?? undefined,
        currentChargedAmount: data.currentChargedAmount,
        currentPeriodEnd: data.currentPeriodEnd,
        targetProductId: data.targetProductId,
        targetCycle: data.targetCycle,
        listAmount: data.listAmount,
        proratedAmount: data.proratedAmount,
        overrideAmount: data.overrideAmount,
        overrideStatus: data.overrideStatus,
        overrideApprovedByProfileId: data.overrideApprovedByProfileId,
        overrideApprovedAt: data.overrideApprovedAt,
        chargeAmount: data.chargeAmount,
        createdByBackofficeUserId: data.createdByBackofficeUserId,
      },
      select: CHANGE_ORDER_SELECT,
    })

    return mapRecord(created)
  }

  async findById(id: string): Promise<BackofficeSubscriptionChangeOrderRecord | null> {
    const order = await prisma.backofficeSubscriptionChangeOrder.findUnique({
      where: { id },
      select: CHANGE_ORDER_SELECT,
    })

    return order ? mapRecord(order) : null
  }

  async approveOverride(
    id: string,
    approverProfileId: string
  ): Promise<BackofficeSubscriptionChangeOrderRecord> {
    const updated = await prisma.backofficeSubscriptionChangeOrder.update({
      where: { id },
      data: {
        overrideStatus: "approved",
        overrideApprovedByProfileId: approverProfileId,
        overrideApprovedAt: new Date(),
      },
      select: CHANGE_ORDER_SELECT,
    })

    return mapRecord(updated)
  }

  async updateMasterAsaasCustomer(masterProfileId: string, customerId: string): Promise<void> {
    await prisma.profile.update({
      where: { id: masterProfileId },
      data: { asaasCustomerId: customerId, asaasCustomerAccount: "primary" satisfies AsaasAccount },
    })
  }

  async attachPayment(
    id: string,
    data: AttachSubscriptionChangeOrderPaymentData
  ): Promise<BackofficeSubscriptionChangeOrderRecord> {
    const updated = await prisma.backofficeSubscriptionChangeOrder.update({
      where: { id },
      data: {
        status: "awaiting_payment",
        asaasPaymentId: data.asaasPaymentId,
        asaasAccount: data.asaasAccount,
        paymentInvoiceUrl: data.paymentInvoiceUrl,
      },
      select: CHANGE_ORDER_SELECT,
    })

    return mapRecord(updated)
  }
}

export const backofficeSubscriptionChangeOrderRepository = new BackofficeSubscriptionChangeOrderRepository()
