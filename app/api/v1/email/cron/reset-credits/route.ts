import { NextResponse, type NextRequest } from "next/server"
import { randomUUID } from "crypto"
import { Output } from "@/lib/output"
import { prisma } from "@/app/api/infra/data/prisma"

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
    }

    const now = new Date()

    // Buscar assinaturas ativas com período vencido
    const expiredSubscriptions = await prisma.emailCreditSubscription.findMany({
      where: {
        status: "active",
        currentPeriodEnd: { lte: now },
      },
      include: {
        usages: {
          where: {
            periodStart: { lte: now },
            periodEnd: { gte: now },
          },
          take: 1,
        },
      },
    })

    let resetCount = 0

    for (const subscription of expiredSubscriptions) {
      const usage = subscription.usages[0]

      // Calcular novo período
      const newPeriodStart = new Date(subscription.currentPeriodEnd)
      const newPeriodEnd = new Date(newPeriodStart)
      newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1)

      await prisma.$transaction([
        // Atualizar período da assinatura
        prisma.emailCreditSubscription.update({
          where: { id: subscription.id },
          data: {
            currentPeriodStart: newPeriodStart,
            currentPeriodEnd: newPeriodEnd,
          },
        }),
        // Criar uso para o novo período
        prisma.emailCreditUsage.create({
          data: {
            id: randomUUID(),
            subscriptionId: subscription.id,
            periodStart: newPeriodStart,
            periodEnd: newPeriodEnd,
            creditsUsed: 0,
            overageCount: 0,
            overageCharged: 0,
          },
        }),
      ])

      resetCount++

      if (usage && Number(usage.overageCharged) > 0) {
        // TODO: Fase 2 avançada — criar cobrança avulsa no Asaas pelo excedente
        console.info(
          `[EmailCronResetCredits] Assinatura ${subscription.id} teve excedente de R$${usage.overageCharged} — cobrança avulsa pendente de implementação`
        )
      }
    }

    console.info(`[EmailCronResetCredits] ${resetCount} assinaturas renovadas`)
    return NextResponse.json(new Output(true, [`${resetCount} assinaturas renovadas`], [], { reset: resetCount }), { status: 200 })
  } catch (error) {
    console.error("[EmailCronResetCreditsRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno no cron de reset de créditos"], null), { status: 500 })
  }
}
