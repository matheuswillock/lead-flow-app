import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import {
  getBackofficeAccess,
  type BackofficeAccess,
} from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import type { StudioPublicFormsActor } from "@/app/api/useCases/backofficeStudioPublicForms/BackofficeStudioPublicFormsUseCase"

export type StudioPublicFormsRouteParams = {
  id: string
  teamId: string
}

export type StudioPublicFormsFormRouteParams = StudioPublicFormsRouteParams & {
  formId: string
}

export async function resolveStudioPublicFormsActor(
  request: NextRequest,
  params: Promise<StudioPublicFormsRouteParams>,
  options?: { requireManager?: boolean }
): Promise<
  | { actor: StudioPublicFormsActor; error?: never }
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
  const actor: StudioPublicFormsActor = {
    access: accessResult.access as BackofficeAccess,
    masterId,
    teamId,
  }
  return { actor }
}

export function studioPublicFormsJson(
  output: Output,
  statusWhenValid = 200,
  statusWhenInvalid = 400
) {
  return NextResponse.json(output, {
    status: output.isValid ? statusWhenValid : statusWhenInvalid,
  })
}

export function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
