import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import {
  getBackofficeAccess,
  type BackofficeAccess,
} from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import type { StudioEmailActor } from "@/app/api/useCases/backofficeStudioEmail/BackofficeStudioEmailUseCase"

export type StudioEmailRouteParams = {
  id: string
  teamId: string
}

export async function resolveStudioEmailActor(
  request: NextRequest,
  params: Promise<StudioEmailRouteParams>,
  options?: { requireManager?: boolean }
): Promise<
  | { actor: StudioEmailActor; error?: never }
  | { actor?: never; error: NextResponse }
> {
  const accessResult = await getBackofficeAccess(request)
  if (accessResult.error) {
    return {
      error: NextResponse.json(accessResult.error, { status: accessResult.status }),
    }
  }

  if (options?.requireManager !== false) {
    const denied = requireManagerAccess(accessResult.access)
    if (denied) return { error: denied }
  }

  const { id: masterId, teamId } = await params
  const actor: StudioEmailActor = {
    access: accessResult.access as BackofficeAccess,
    masterId,
    teamId,
  }
  return { actor }
}

export function studioEmailJson(output: Output, statusWhenValid = 200, statusWhenInvalid = 400) {
  return NextResponse.json(output, {
    status: output.isValid ? statusWhenValid : statusWhenInvalid,
  })
}

export function studioEmailError(messages: string[], status = 500) {
  return NextResponse.json(new Output(false, [], messages, null), { status })
}

export function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
