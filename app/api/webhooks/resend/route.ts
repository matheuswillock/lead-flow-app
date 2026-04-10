import { NextResponse, type NextRequest } from "next/server"
import { Webhook } from "svix"
import { prisma } from "@/app/api/infra/data/prisma"
import { Prisma } from "@prisma/client"
import type { EmailEventType } from "@prisma/client"
import { randomUUID } from "crypto"

type ResendWebhookEvent = {
  type: string
  data: {
    email_id: string
    created_at: string
    to?: string[]
    click?: { link: string; userAgent: string; ipAddress: string }
    bounce?: { message: string }
  }
}

const EVENT_TYPE_MAP: Record<string, EmailEventType> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.delivery_delayed": "delivery_delayed",
  "email.unsubscribed": "unsubscribed",
}

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error("[ResendWebhookRoute][POST] RESEND_WEBHOOK_SECRET não configurado")
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const svixId = request.headers.get("svix-id")
    const svixTimestamp = request.headers.get("svix-timestamp")
    const svixSignature = request.headers.get("svix-signature")

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error("[ResendWebhookRoute][POST] Headers svix ausentes")
      return NextResponse.json({ error: "Headers de assinatura ausentes" }, { status: 400 })
    }

    const rawBody = await request.text()

    const wh = new Webhook(webhookSecret)
    let event: ResendWebhookEvent

    try {
      event = wh.verify(rawBody, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as ResendWebhookEvent
    } catch (verifyError) {
      console.error("[ResendWebhookRoute][POST] Assinatura inválida:", verifyError)
      return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 })
    }

    const resendEmailId = event.data?.email_id
    const eventType = EVENT_TYPE_MAP[event.type]

    if (!resendEmailId || !eventType) {
      console.info("[ResendWebhookRoute][POST] Evento ignorado:", event.type)
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const log = await prisma.emailLog.findUnique({
      where: { resendEmailId },
    })

    if (!log) {
      console.info("[ResendWebhookRoute][POST] EmailLog não encontrado para resendEmailId:", resendEmailId)
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const occurredAt = event.data.created_at ? new Date(event.data.created_at) : new Date()

    const metadata: Record<string, unknown> = {}
    if (event.data.click) {
      metadata.link = event.data.click.link
      metadata.userAgent = event.data.click.userAgent
      metadata.ipAddress = event.data.click.ipAddress
    }
    if (event.data.bounce) {
      metadata.bounceMessage = event.data.bounce.message
    }

    // Mapear eventType para campo de timestamp no EmailLog
    const timestampField: Partial<Record<EmailEventType, string>> = {
      delivered: "deliveredAt",
      opened: "openedAt",
      clicked: "clickedAt",
      bounced: "bouncedAt",
      complained: "complainedAt",
    }

    const timestampUpdate = timestampField[eventType]
      ? { [timestampField[eventType]!]: occurredAt }
      : {}

    const statusPriority: string[] = [
      "complained", "bounced", "clicked", "opened", "delivered", "sent", "queued"
    ]
    const currentStatusIdx = statusPriority.indexOf(log.status as EmailEventType)
    const newStatusIdx = statusPriority.indexOf(eventType)
    const shouldUpdateStatus = newStatusIdx !== -1 && (currentStatusIdx === -1 || newStatusIdx < currentStatusIdx)

    await prisma.$transaction(async (tx) => {
      // Criar evento
      await tx.emailEvent.create({
        data: {
          id: randomUUID(),
          logId: log.id,
          type: eventType,
          occurredAt,
          metadata: Object.keys(metadata).length > 0 ? (metadata as Prisma.InputJsonValue) : undefined,
        },
      })

      // Atualizar log
      await tx.emailLog.update({
        where: { id: log.id },
        data: {
          ...(shouldUpdateStatus && { status: eventType as never }),
          ...timestampUpdate,
        },
      })

      // Atualizar contato em caso de bounce ou reclamação
      if (eventType === "bounced") {
        await tx.emailContact.updateMany({
          where: { email: log.recipientEmail },
          data: { isBounced: true },
        })
      }
      if (eventType === "complained") {
        await tx.emailContact.updateMany({
          where: { email: log.recipientEmail },
          data: { isComplained: true, isUnsubscribed: true },
        })
      }

      // Incrementar contadores na campanha
      if (log.campaignId) {
        const campaignIncrements: Record<string, number> = {}
        if (eventType === "delivered") campaignIncrements.totalDelivered = 1
        if (eventType === "opened") campaignIncrements.totalOpened = 1
        if (eventType === "clicked") campaignIncrements.totalClicked = 1
        if (eventType === "bounced") campaignIncrements.totalBounced = 1
        if (eventType === "complained") campaignIncrements.totalComplained = 1

        if (Object.keys(campaignIncrements).length > 0) {
          await tx.emailCampaign.update({
            where: { id: log.campaignId },
            data: Object.fromEntries(
              Object.entries(campaignIncrements).map(([k, v]) => [k, { increment: v }])
            ),
          })
        }
      }
    })

    console.info(`[ResendWebhookRoute][POST] Evento ${event.type} processado para log ${log.id}`)
    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error("[ResendWebhookRoute][POST]", error)
    // Sempre retorna 200 para não bloquear fila do Resend
    return NextResponse.json({ received: true }, { status: 200 })
  }
}
