import { z } from "zod"
import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import {
  BACKOFFICE_GOOGLE_EMAIL_CONFLICT_MESSAGE,
  backofficeAccountUseCase,
} from "@/app/api/useCases/backofficeAccount/BackofficeAccountUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

const connectSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
  expiresAt: z.string().datetime().optional(),
  email: z.string().email().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }

    const body = await request.json().catch(() => null)
    const validation = connectSchema.safeParse(body)
    if (!validation.success) {
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
      const isConflict = output.errorMessages.includes(BACKOFFICE_GOOGLE_EMAIL_CONFLICT_MESSAGE)
      return NextResponse.json(output, { status: isConflict ? 409 : 400 })
    }

    return NextResponse.json(output, { status: 200 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeGoogleConnectRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
