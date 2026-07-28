import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { closerBusyBlockUseCase } from "@/app/api/useCases/closerBusyBlock/CloserBusyBlockUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

const upsertSchema = z
  .object({
    profileId: z.string().uuid(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    allDay: z.boolean(),
    isRecurring: z.boolean(),
    weekdays: z.array(z.number().int().min(0).max(6)).default([]),
    recurrenceEndsAt: z.string().datetime().nullable().optional(),
    syncToGoogle: z.boolean(),
    reason: z.string().max(500).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.isRecurring && value.weekdays.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione ao menos um dia da semana.",
        path: ["weekdays"],
      })
    }
    if (value.isRecurring && !value.recurrenceEndsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe a data final da recorrência.",
        path: ["recurrenceEndsAt"],
      })
    }
  })

export async function GET(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const { searchParams } = new URL(request.url)
    const fromParam = searchParams.get("from")
    const toParam = searchParams.get("to")
    const closerId = searchParams.get("closerId") ?? undefined

    if (!fromParam || !toParam) {
      const output = new Output(false, [], ["Informe from e to (ISO)."], null)
      return NextResponse.json(output, { status: 400 })
    }

    const from = new Date(fromParam)
    const to = new Date(toParam)
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      const output = new Output(false, [], ["Intervalo from/to inválido."], null)
      return NextResponse.json(output, { status: 400 })
    }

    const output = await closerBusyBlockUseCase.list({
      access: teamAccess.access,
      from,
      to,
      closerId,
    })

    return NextResponse.json(output, { status: output.isValid ? 200 : 403 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[CalendarBusyBlocksRoute][GET] Erro:", error)
    const output = new Output(false, [], ["Erro interno do servidor"], null)
    return NextResponse.json(output, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const body = await request.json().catch(() => null)
    const validation = upsertSchema.safeParse(body)
    if (!validation.success) {
      const output = new Output(
        false,
        [],
        validation.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
        null
      )
      return NextResponse.json(output, { status: 400 })
    }

    const output = await closerBusyBlockUseCase.create({
      access: teamAccess.access,
      input: validation.data,
    })

    const status = output.isValid ? 201 : output.errorMessages.some((m) => m.includes("permissão")) ? 403 : 400
    return NextResponse.json(output, { status })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[CalendarBusyBlocksRoute][POST] Erro:", error)
    const output = new Output(false, [], ["Erro interno do servidor"], null)
    return NextResponse.json(output, { status: 500 })
  }
}
