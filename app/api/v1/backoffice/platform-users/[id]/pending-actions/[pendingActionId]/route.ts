import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { backofficePlatformUsersUseCase } from "@/app/api/useCases/backoffice/BackofficePlatformUsersUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string; pendingActionId: string }>
  }
) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    const denied = requireManagerAccess(result.access)
    if (denied) return denied

    const { id, pendingActionId } = await params
    const actor = {
      profileId: result.access.profileId,
      backofficeUserId: result.access.backofficeUserId,
      backofficeEmail: result.access.backofficeEmail,
    }

    console.info(
      "[BackofficePlatformUserPendingActionByIdRoute][DELETE] Solicitação de cancelamento de ação pendente",
      {
        masterProfileId: id,
        pendingActionId,
        actorProfileId: actor.profileId,
        actorBackofficeUserId: actor.backofficeUserId,
        actorEmail: actor.backofficeEmail,
      }
    )

    const output = await backofficePlatformUsersUseCase.cancelMasterUserPendingAction(
      id,
      pendingActionId,
      actor
    )

    if (output.isValid) {
      console.info(
        "[BackofficePlatformUserPendingActionByIdRoute][DELETE] Ação pendente cancelada com sucesso",
        {
          masterProfileId: id,
          pendingActionId,
          actorProfileId: actor.profileId,
          actorBackofficeUserId: actor.backofficeUserId,
          actorEmail: actor.backofficeEmail,
          result: output.result,
        }
      )
      return NextResponse.json(output, { status: 200 })
    }

    const notFound = output.errorMessages.some(
      (message) =>
        message.toLowerCase().includes("não encontrada") ||
        message.toLowerCase().includes("não encontrado")
    )

    console.info(
      "[BackofficePlatformUserPendingActionByIdRoute][DELETE] Cancelamento de ação pendente rejeitado",
      {
        masterProfileId: id,
        pendingActionId,
        actorProfileId: actor.profileId,
        actorBackofficeUserId: actor.backofficeUserId,
        actorEmail: actor.backofficeEmail,
        errorMessages: output.errorMessages,
      }
    )

    return NextResponse.json(output, { status: notFound ? 404 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficePlatformUserPendingActionByIdRoute][DELETE]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
