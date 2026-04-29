import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeMetaWebhookUseCase } from "@/app/api/useCases/backofficeMetaWebhook/BackofficeMetaWebhookUseCase"
import type { BackofficeWebhookTokenExpiryModeValue } from "@/lib/webhooks/backofficeWebhookSecurity"

const EXPIRY_MODE_VALUES = ["hours_24", "months_6", "indeterminate"] as const

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function parseExpiryMode(value: unknown): BackofficeWebhookTokenExpiryModeValue | null {
  if (typeof value !== "string") return "indeterminate"
  if (!EXPIRY_MODE_VALUES.includes(value as (typeof EXPIRY_MODE_VALUES)[number])) {
    return null
  }
  return value as BackofficeWebhookTokenExpiryModeValue
}

export async function GET(request: NextRequest) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    const { searchParams } = new URL(request.url)
    const view = searchParams.get("view")

    if (view === "logs") {
      const limit = Math.min(parsePositiveInt(searchParams.get("limit"), 15), 100)
      const output = await backofficeMetaWebhookUseCase.listRequestLogs(limit)
      return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
    }

    if (view === "tokens") {
      const limit = Math.min(parsePositiveInt(searchParams.get("limit"), 15), 100)
      const output = await backofficeMetaWebhookUseCase.listTokenHistory(limit)
      return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
    }

    if (view === "events") {
      const limit = Math.min(parsePositiveInt(searchParams.get("limit"), 25), 100)
      const output = await backofficeMetaWebhookUseCase.listRecentEvents(limit)
      return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
    }

    const output = await backofficeMetaWebhookUseCase.getIntegrationConfig()
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[BackofficeMetaIntegrationRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

async function handleGenerateToken(request: NextRequest) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    if (!result.access.backofficeUserId) {
      return NextResponse.json(
        new Output(false, [], ["Usuário backoffice inválido para gerar token"], null),
        { status: 403 }
      )
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const expiryMode = parseExpiryMode(body.expiryMode)
    if (!expiryMode) {
      return NextResponse.json(
        new Output(false, [], ["Modo de expiração inválido"], null),
        { status: 400 }
      )
    }

    const output = await backofficeMetaWebhookUseCase.generateToken({
      expiryMode,
      generatedByBackofficeUserId: result.access.backofficeUserId,
      generatedByEmailSnapshot: result.access.backofficeEmail,
    })
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[BackofficeMetaIntegrationRoute][GENERATE_TOKEN]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return handleGenerateToken(request)
}

export async function PUT(request: NextRequest) {
  return handleGenerateToken(request)
}
