import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { backofficeMemberAccessEmailUseCase } from "@/app/api/useCases/backoffice/BackofficeMemberAccessEmailUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

const bodySchema = z.object({
  mode: z.enum(["invite", "reset_password"]),
  accountMasterId: z.string().uuid(),
  // Entregável 3 (botão "Copiar link do convite"): gera o link novo sem
  // disparar e-mail. Só vale para mode: "invite" — validado abaixo.
  deliver: z.enum(["email", "link"]).optional().default("email"),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }
    const denied = requireManagerAccess(accessResult.access)
    if (denied) return denied

    const body = bodySchema.safeParse(await request.json().catch(() => ({})))
    if (!body.success) {
      return NextResponse.json(
        new Output(false, [], body.error.issues.map((issue) => issue.message), null),
        { status: 400 }
      )
    }

    const { memberId } = await params

    if (body.data.deliver === "link") {
      if (body.data.mode !== "invite") {
        return NextResponse.json(
          new Output(false, [], ["Copiar link disponível apenas para convite"], null),
          { status: 400 }
        )
      }
      const output = await backofficeMemberAccessEmailUseCase.generateInviteLink({
        profileId: memberId,
        accountMasterId: body.data.accountMasterId,
      })
      const status = output.isValid
        ? 200
        : output.errorMessages.includes("Membro não encontrado")
          ? 404
          : 400
      return NextResponse.json(output, { status })
    }

    const output = await backofficeMemberAccessEmailUseCase.sendAccessEmail({
      profileId: memberId,
      accountMasterId: body.data.accountMasterId,
      mode: body.data.mode,
    })

    const status = output.isValid
      ? 200
      : output.errorMessages.includes("Membro não encontrado")
        ? 404
        : 400

    return NextResponse.json(output, { status })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeMemberAccessEmailRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
