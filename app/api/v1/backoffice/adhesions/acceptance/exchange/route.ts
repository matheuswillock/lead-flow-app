import { NextResponse, type NextRequest } from "next/server"
import { getFullUrl } from "@/lib/utils/app-url"

const COOKIE_NAME = "cs_acceptance_session"

export async function GET(request: NextRequest) {
  console.info("[BackofficeTermsAcceptanceExchangeRoute][GET] iniciado")
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? ""
  if (token.length < 32) {
    return NextResponse.redirect(getFullUrl("/primeiro-acesso/aceite?erro=link-invalido"))
  }

  const response = NextResponse.redirect(getFullUrl("/primeiro-acesso/aceite"))
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60,
    path: "/api/v1/backoffice/adhesions/acceptance",
  })
  response.headers.set("Cache-Control", "no-store")
  response.headers.set("Referrer-Policy", "no-referrer")
  return response
}

