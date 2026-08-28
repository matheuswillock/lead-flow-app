import { NextRequest, NextResponse, connection } from "next/server";
import { Output } from "@/lib/output"
import { profileTimezoneUseCase } from "@/app/api/useCases/profileTimezone/ProfileTimezoneUseCase"
import { assertProfileOwnership } from "@/app/api/v1/profiles/utils/assertProfileOwnership"
import { invalidatePublicFormBootstrapCache } from "@/lib/cache/invalidation"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

/**
 * GET /api/v1/profiles/[supabaseId]/timezone
 * Returns the timezone for a profile.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  await connection();

  try {
    const { supabaseId } = await params

    const access = await assertProfileOwnership(request, supabaseId)
    if (access.error) {
      return NextResponse.json(access.error, { status: access.status })
    }

    const output = await profileTimezoneUseCase.getTimezone(supabaseId)
    const status = output.isValid ? 200 : output.errorMessages.includes("Perfil não encontrado") ? 404 : 500
    return NextResponse.json(output, { status })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[ProfileTimezoneRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

/**
 * PATCH /api/v1/profiles/[supabaseId]/timezone
 * Updates the timezone for a profile.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  try {
    const { supabaseId } = await params

    const access = await assertProfileOwnership(request, supabaseId)
    if (access.error) {
      return NextResponse.json(access.error, { status: access.status })
    }

    const body = await request.json()

    const output = await profileTimezoneUseCase.updateTimezone(supabaseId, body?.timezone)

    if (output.isValid) {
      // O bootstrap do formulário público exibe o fuso do master do time.
      const { affectedTeamIds } = output.result as { affectedTeamIds: string[] }
      for (const teamId of affectedTeamIds) {
        invalidatePublicFormBootstrapCache({ teamId })
      }
    }

    const firstError = output.errorMessages[0] ?? ""
    const status = output.isValid
      ? 200
      : firstError === "Perfil não encontrado"
        ? 404
        : firstError === "Timezone inválido"
          ? 400
          : 500

    return NextResponse.json(output, { status })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[ProfileTimezoneRoute][PATCH]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
