import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { EmailTeamSettingsUseCase } from "@/app/api/useCases/email/EmailTeamSettingsUseCase"
import { isManagerLikeRole } from "@/lib/roles"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

const trackingSchema = z
  .object({
    trackingSubdomain: z
      .string()
      .min(1)
      .max(63)
      .regex(
        /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/,
        "Use apenas letras minúsculas, números e hífen (ex.: links)"
      ),
    openTracking: z.boolean(),
    // Aceito e descartado. O rastreio de cliques do Resend reescreve os links do
    // e-mail para o subdomínio de tracking, e provedores marcam a mensagem como
    // suspeita; os cliques já vêm do first-party do formulário. A UI não oferece
    // mais o controle — a rota também não obedece a ele, senão a garantia
    // dependeria só do cliente.
    clickTracking: z.boolean().optional(),
  })

function makeUseCase() {
  return new EmailTeamSettingsUseCase()
}

export async function PATCH(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    if (!isManagerLikeRole(teamAccess.access.teamMember.role)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas managers podem configurar tracking do domínio"], null),
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => null)
    const validation = trackingSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 })
    }

    const useCase = makeUseCase()
    const output = await useCase.configureDomainTracking(
      {
        trackingSubdomain: validation.data.trackingSubdomain,
        openTracking: validation.data.openTracking,
      },
      teamAccess.access
    )
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[EmailSettingsDomainTrackingRoute][PATCH]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
