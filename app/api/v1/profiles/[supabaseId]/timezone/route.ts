import { NextRequest, NextResponse, connection } from "next/server";
import { prisma } from "@/app/api/infra/data/prisma"
import { Output } from "@/lib/output"
import { isValidTimezone } from "@/lib/dates"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

/**
 * GET /api/v1/profiles/[supabaseId]/timezone
 * Returns the timezone for a profile.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  await connection();

  try {
    const { supabaseId } = await params
    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { timezone: true },
    })
    if (!profile) {
      return NextResponse.json(new Output(false, [], ["Perfil não encontrado"], null), { status: 404 })
    }
    return NextResponse.json(new Output(true, [], [], { timezone: profile.timezone }), { status: 200 })
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
    const body = await request.json()
    const timezone: string = body?.timezone

    if (!timezone || !isValidTimezone(timezone)) {
      return NextResponse.json(
        new Output(false, [], ["Timezone inválido"], null),
        { status: 400 }
      )
    }

    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { id: true },
    })
    if (!profile) {
      return NextResponse.json(new Output(false, [], ["Perfil não encontrado"], null), { status: 404 })
    }

    await prisma.profile.update({
      where: { supabaseId },
      data: { timezone },
    })

    return NextResponse.json(new Output(true, ["Fuso horário atualizado"], [], { timezone }), { status: 200 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[ProfileTimezoneRoute][PATCH]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
