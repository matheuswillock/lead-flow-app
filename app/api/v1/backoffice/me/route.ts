import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/app/api/infra/data/prisma"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"

export async function GET(request: NextRequest) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    const { profileId } = result.access

    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: {
        fullName: true,
        email: true,
        backofficeUser: { select: { fullAccess: true } },
      },
    })

    if (!profile) {
      const output = new Output(false, [], ["Perfil não encontrado"], null)
      return NextResponse.json(output, { status: 404 })
    }

    const output = new Output(true, [], [], {
      profileId,
      email: profile.email,
      fullName: profile.fullName,
      fullAccess: profile.backofficeUser?.fullAccess ?? false,
    })
    return NextResponse.json(output, { status: 200 })
  } catch (error) {
    console.error("[BackofficeMeRoute][GET]", error)
    const output = new Output(false, [], ["Erro interno"], null)
    return NextResponse.json(output, { status: 500 })
  }
}
