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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const { id } = await params
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

    const output = await closerBusyBlockUseCase.update({
      access: teamAccess.access,
      id,
      input: validation.data,
    })

    const status = output.isValid
      ? 200
      : output.errorMessages.some((m) => m.includes("não encontrada"))
        ? 404
        : output.errorMessages.some((m) => m.includes("permissão"))
          ? 403
          : 400

    return NextResponse.json(output, { status })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[CalendarBusyBlockByIdRoute][PATCH] Erro:", error)
    const output = new Output(false, [], ["Erro interno do servidor"], null)
    return NextResponse.json(output, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const { id } = await params
    const output = await closerBusyBlockUseCase.remove({
      access: teamAccess.access,
      id,
    })

    const status = output.isValid
      ? 200
      : output.errorMessages.some((m) => m.includes("não encontrada"))
        ? 404
        : output.errorMessages.some((m) => m.includes("permissão"))
          ? 403
          : 400

    return NextResponse.json(output, { status })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[CalendarBusyBlockByIdRoute][DELETE] Erro:", error)
    const output = new Output(false, [], ["Erro interno do servidor"], null)
    return NextResponse.json(output, { status: 500 })
  }
}
