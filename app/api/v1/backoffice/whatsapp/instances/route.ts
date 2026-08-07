import { NextResponse, type NextRequest, connection } from "next/server";
import { z } from "zod"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { backofficeWhatsAppInstanceUseCase } from "@/app/api/useCases/backofficeWhatsApp/BackofficeWhatsAppInstanceUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

const VALID_STATUSES = [
  "PENDING",
  "QR_READY",
  "CONNECTED",
  "DISCONNECTED",
  "ERROR",
  "BANNED",
] as const

type WhatsAppConnectionStatus = (typeof VALID_STATUSES)[number]

const provisionSchema = z.object({
  teamId: z.string().uuid(),
  usageLimitMonthly: z.number().int().min(0).optional(),
})

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return parsed
}

function parseStatus(value: string | null): WhatsAppConnectionStatus | undefined {
  if (!value) return undefined
  return VALID_STATUSES.includes(value as WhatsAppConnectionStatus)
    ? (value as WhatsAppConnectionStatus)
    : undefined
}

export async function GET(request: NextRequest) {
  await connection();

  try {
    const access = await getBackofficeAccess(request)
    if (access.error) return NextResponse.json(access.error, { status: access.status })

    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q") ?? undefined
    const status = parseStatus(searchParams.get("status"))
    const page = parsePositiveInt(searchParams.get("page"), 1)
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), 10)

    const output = await backofficeWhatsAppInstanceUseCase.listInstances(
      { q, status },
      { page, pageSize }
    )
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeWhatsAppInstancesRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await getBackofficeAccess(request)
    if (access.error) return NextResponse.json(access.error, { status: access.status })
    const denied = requireManagerAccess(access.access)
    if (denied) return denied

    const parsed = provisionSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 })
    }

    const output = await backofficeWhatsAppInstanceUseCase.provisionInstance({
      teamId: parsed.data.teamId,
      profileId: access.access.profileId,
      usageLimitMonthly: parsed.data.usageLimitMonthly,
    })
    return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeWhatsAppInstancesRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
