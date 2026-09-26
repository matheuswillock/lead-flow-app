import "server-only"

import { NextResponse } from "next/server"
import { prisma } from "@/app/api/infra/data/prisma"
import { Output } from "@/lib/output"
import { classifyFormsHost, normalizeHostname } from "@/lib/proxy/forms-host"

const FOREIGN_HOST_MESSAGE = "Landing page não encontrada"

export async function isLandingPageServableOnHost(input: {
  landingPageId: string
  hostHeader: string | null | undefined
}): Promise<boolean> {
  if (classifyFormsHost(input.hostHeader) !== "custom") return true
  const hostname = normalizeHostname(input.hostHeader)
  if (!hostname) return false

  const domain = await prisma.teamLandingDomain.findUnique({
    where: { hostname, status: "verified" },
    select: { teamId: true },
  })
  if (!domain) return false

  const landing = await prisma.landingPage.findUnique({
    where: { publicId: input.landingPageId },
    select: { teamId: true },
  })
  return landing?.teamId === domain.teamId
}

export async function rejectLandingPageRequestOnForeignHost(
  request: Request,
  landingPageId: string,
): Promise<NextResponse | null> {
  const allowed = await isLandingPageServableOnHost({
    landingPageId,
    hostHeader: request.headers.get("host"),
  })
  if (allowed) return null
  return NextResponse.json(new Output(false, [], [FOREIGN_HOST_MESSAGE], null), { status: 404 })
}
