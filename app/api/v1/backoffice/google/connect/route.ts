import { z } from "zod"
import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import {
  BACKOFFICE_GOOGLE_EMAIL_CONFLICT_MESSAGE,
  backofficeAccountUseCase,
} from "@/app/api/useCases/backofficeAccount/BackofficeAccountUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';
import { googleConnectionEventService } from "@/app/api/services/googleConnectionEvent/GoogleConnectionEventService";
import { GoogleConnectionEventType, GoogleConnectionFlow } from "@prisma/client";

const connectSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
  expiresAt: z.string().datetime().optional(),
  email: z.string().email().optional(),
})

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID()
  let profileId: string | null = null
  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }

    profileId = accessResult.access.profileId
    await googleConnectionEventService.record({ eventType: GoogleConnectionEventType.STARTED, flow: GoogleConnectionFlow.BACKOFFICE, profileId, requestId })
    const body = await request.json().catch(() => null)
    const validation = connectSchema.safeParse(body)
    if (!validation.success) {
      await googleConnectionEventService.record({ eventType: GoogleConnectionEventType.FAILED, flow: GoogleConnectionFlow.BACKOFFICE, profileId, errorCategory: "validation", requestId })
      return NextResponse.json(
        new Output(
          false,
          [],
          validation.error.issues.map((issue) => issue.message),
          null
        ),
        { status: 400 }
      )
    }

    const output = await backofficeAccountUseCase.connectGoogle(
      accessResult.access.profileId,
      validation.data
    )

    if (!output.isValid) {
      await googleConnectionEventService.record({ eventType: GoogleConnectionEventType.FAILED, flow: GoogleConnectionFlow.BACKOFFICE, profileId, errorCategory: "connection_rejected", requestId })
      const isConflict = output.errorMessages.includes(BACKOFFICE_GOOGLE_EMAIL_CONFLICT_MESSAGE)
      return NextResponse.json(output, { status: isConflict ? 409 : 400 })
    }

    await googleConnectionEventService.record({ eventType: GoogleConnectionEventType.SUCCEEDED, flow: GoogleConnectionFlow.BACKOFFICE, profileId, googleEmail: validation.data.email ?? null, requestId })

    return NextResponse.json(output, { status: 200 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeGoogleConnectRoute][POST]", error)
    await googleConnectionEventService.record({ eventType: GoogleConnectionEventType.FAILED, flow: GoogleConnectionFlow.BACKOFFICE, profileId, errorCategory: "unexpected", requestId })
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
