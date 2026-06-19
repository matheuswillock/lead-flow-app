import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { EmailTemplateUseCase } from "@/app/api/useCases/email/EmailTemplateUseCase"
import { EmailTeamVariablesUseCase } from "@/app/api/useCases/email/EmailTeamVariablesUseCase"
import { assertResend, buildResendIdempotencyKey } from "@/lib/email"
import { interpolateEmailTemplate } from "@/lib/email/interpolate"

const bodySchema = z.object({
  to: z.string().email("Endereço de email inválido"),
})

const FROM = "Corretor Studio <no-reply@corretorstudio.com>"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const body = await request.json().catch(() => null)
    const validation = bodySchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 })
    }

    const useCase = new EmailTemplateUseCase()
    const templateOutput = await useCase.getById(id, teamAccess.access)
    if (!templateOutput.isValid || !templateOutput.result) {
      return NextResponse.json(templateOutput, { status: 404 })
    }

    const template = templateOutput.result as {
      subject: string
      html: string | null
      previewText: string | null
      variables: Array<{ key: string; fallbackValue?: string | null }> | null
    }

    if (!template.html) {
      return NextResponse.json(
        new Output(false, [], ["Template não possui HTML para envio"], null),
        { status: 400 }
      )
    }

    // Build interpolation defaults: team global variables, then template-local fallbacks override.
    const variablesUseCase = new EmailTeamVariablesUseCase()
    const defaultsOutput = await variablesUseCase.getDefaultsMap(teamAccess.access)
    const defaults: Record<string, string> = defaultsOutput.isValid
      ? { ...(defaultsOutput.result as Record<string, string>) }
      : {}
    for (const v of template.variables ?? []) {
      if (v.fallbackValue != null && v.fallbackValue !== "") defaults[v.key] = v.fallbackValue
    }

    const recipient = { email: validation.data.to, name: validation.data.to.split("@")[0] }

    const resend = assertResend()
    const { error } = await resend.emails.send(
      {
        from: FROM,
        to: validation.data.to,
        subject: `[Teste] ${interpolateEmailTemplate(template.subject, recipient, defaults)}`,
        html: interpolateEmailTemplate(template.html, recipient, defaults),
      },
      {
        idempotencyKey: buildResendIdempotencyKey(
          "template-test",
          `${id}/${validation.data.to.toLowerCase()}`
        ),
      }
    )

    if (error) {
      console.error("[EmailTemplateTestRoute][POST] Resend error", error)
      return NextResponse.json(
        new Output(false, [], [error.message ?? "Erro ao enviar email de teste"], null),
        { status: 500 }
      )
    }

    console.info("[EmailTemplateTestRoute][POST] Test email sent", { id, to: validation.data.to })
    return NextResponse.json(
      new Output(true, [`Email de teste enviado para ${validation.data.to}`], [], null)
    )
  } catch (error) {
    console.error("[EmailTemplateTestRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
