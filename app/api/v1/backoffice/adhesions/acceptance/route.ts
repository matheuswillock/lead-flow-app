import { NextResponse, type NextRequest } from "next/server"
import { backofficeTermsAcceptanceUseCase } from "@/app/api/useCases/backofficeTermsAcceptance/BackofficeTermsAcceptanceUseCase"
import type { SubmitAcceptanceInput } from "@/app/api/useCases/backofficeTermsAcceptance/IBackofficeTermsAcceptanceUseCase"

const COOKIE_NAME = "cs_acceptance_session"

function statusFor(output: { isValid: boolean; result?: unknown }): number {
  if (output.isValid) return 200
  const code = (output.result as { code?: string } | null)?.code
  if (code === "documents_changed") return 409
  if (code === "invalid_token" || code === "expired_token" || code === "too_many_attempts") return 401
  if (code === "documents_unavailable") return 503
  return 400
}

function secureJson(output: unknown, status: number) {
  const response = NextResponse.json(output, { status })
  response.headers.set("Cache-Control", "no-store")
  response.headers.set("Referrer-Policy", "no-referrer")
  response.headers.set("X-Robots-Tag", "noindex, nofollow")
  return response
}

export async function GET(request: NextRequest) {
  console.info("[BackofficeTermsAcceptanceRoute][GET] iniciado")
  const token = request.cookies.get(COOKIE_NAME)?.value ?? ""
  const output = await backofficeTermsAcceptanceUseCase.getPageData(token)
  return secureJson(output, statusFor(output))
}

export async function POST(request: NextRequest) {
  console.info("[BackofficeTermsAcceptanceRoute][POST] iniciado")
  const token = request.cookies.get(COOKIE_NAME)?.value ?? ""
  const body = await request.json() as Omit<SubmitAcceptanceInput, "context">
  const output = await backofficeTermsAcceptanceUseCase.submit(token, {
    ...body,
    context: {
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent") ?? "unknown",
      locale: request.headers.get("accept-language")?.split(",")[0]?.trim() ?? null,
    },
  })
  const response = secureJson(output, statusFor(output))
  if (output.isValid) response.cookies.set(COOKIE_NAME, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", maxAge: 0, path: "/api/v1/backoffice/adhesions/acceptance" })
  return response
}
