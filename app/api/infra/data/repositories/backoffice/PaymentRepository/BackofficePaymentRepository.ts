import type { BackofficePayment } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type { AsaasAccountId } from "@/lib/asaas"
import type {
  IBackofficePaymentRepository,
  CreateBackofficePaymentInput,
  UpdateBackofficePaymentExtra,
} from "./IBackofficePaymentRepository"

export class BackofficePaymentRepository implements IBackofficePaymentRepository {
  async create(data: CreateBackofficePaymentInput): Promise<BackofficePayment> {
    return prisma.backofficePayment.create({
      data: {
        id: data.id,
        clientId: data.clientId,
        billingType: data.billingType ?? "PIX",
        amount: data.amount,
        dueDate: data.dueDate,
        description: data.description,
        asaasPaymentId: data.asaasPaymentId,
        invoiceUrl: data.invoiceUrl,
        pixQrCode: data.pixQrCode,
        pixPayload: data.pixPayload,
        createdByProfileId: data.createdByProfileId,
      },
    })
  }

  async findMany(params?: { clientId?: string; status?: string }): Promise<BackofficePayment[]> {
    return prisma.backofficePayment.findMany({
      where: {
        ...(params?.clientId ? { clientId: params.clientId } : {}),
        ...(params?.status ? { status: params.status } : {}),
      },
      orderBy: { createdAt: "desc" },
    })
  }

  async findById(id: string): Promise<BackofficePayment | null> {
    return prisma.backofficePayment.findUnique({ where: { id } })
  }

  async findByAsaasPaymentId(
    asaasPaymentId: string,
    account: AsaasAccountId
  ): Promise<BackofficePayment | null> {
    return prisma.backofficePayment.findFirst({ where: { asaasPaymentId, asaasAccount: account } })
  }

  async updateStatus(
    id: string,
    status: string,
    extra?: UpdateBackofficePaymentExtra
  ): Promise<BackofficePayment> {
    return prisma.backofficePayment.update({
      where: { id },
      data: {
        status,
        ...(extra?.invoiceUrl !== undefined ? { invoiceUrl: extra.invoiceUrl } : {}),
        ...(extra?.pixQrCode !== undefined ? { pixQrCode: extra.pixQrCode } : {}),
        ...(extra?.pixPayload !== undefined ? { pixPayload: extra.pixPayload } : {}),
      },
    })
  }
}
