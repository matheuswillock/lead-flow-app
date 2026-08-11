import { NextResponse, type NextRequest, connection } from "next/server";
import { randomUUID } from "crypto"
import { Prisma } from "@prisma/client"
import { Output } from "@/lib/output"
import { prisma } from "@/app/api/infra/data/prisma"
import { addMonthsInTz, resolveTimezone } from "@/lib/dates"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { withCronAudit } from "@/app/api/lib/cron/withCronAudit"
import { getDefaultCronSlackCallback } from "@/app/api/lib/cron/cronSlackCallback"

export const maxDuration = 60

export async function GET(request: NextRequest) {
  await connection();

  try {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
    }

    const result = await withCronAudit(
      {
        cronKey: "reset-credits",
        cronPath: "/api/v1/email/cron/reset-credits",
      },
      async () => {
        const now = new Date()

        const expiredSubscriptions = await prisma.emailCreditSubscription.findMany({
          where: {
            status: "active",
            currentPeriodEnd: { lte: now },
          },
          include: {
            team: { select: { master: { select: { timezone: true } } } },
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
          try {
            const usage = subscription.usages[0]
            const ownerTz = resolveTimezone(subscription.team?.master?.timezone)
            const newPeriodStart = new Date(subscription.currentPeriodEnd)
            const newPeriodEnd = addMonthsInTz(newPeriodStart, 1, ownerTz)

            await prisma.$transaction([
              prisma.emailCreditSubscription.update({
                where: { id: subscription.id },
                data: {
                  currentPeriodStart: newPeriodStart,
                  currentPeriodEnd: newPeriodEnd,
                },
              }),
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
              console.info(
                `[EmailCronResetCredits] Assinatura ${subscription.id} teve excedente de R$${usage.overageCharged} — cobrança avulsa pendente de implementação`
              )
            }
          } catch (subscriptionError) {
            if (
              subscriptionError instanceof Prisma.PrismaClientKnownRequestError &&
              subscriptionError.code === "P2002"
            ) {
              console.info(
                `[EmailCronResetCredits] Período já existente para assinatura ${subscription.id} — ignorando`
              )
              continue
            }
            console.error(`[EmailCronResetCredits] Falha na assinatura ${subscription.id}:`, subscriptionError)
          }
        }

        console.info(`[EmailCronResetCredits] ${resetCount} assinaturas renovadas`)
        return new Output(true, [`${resetCount} assinaturas renovadas`], [], { reset: resetCount })
      },
      {
        onFailure: getDefaultCronSlackCallback(),
      }
    )

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[EmailCronResetCreditsRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno no cron de reset de créditos"], null), { status: 500 })
  }
}
