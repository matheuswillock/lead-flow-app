import { shortLinkRepository } from "@/app/api/infra/data/repositories/shortLink/ShortLinkRepository"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
  const { code } = await params
  const record = await shortLinkRepository.findByCode(code)

  if (!record) {
    return NextResponse.json({ error: "Link não encontrado." }, { status: 404 })
  }

  if (record.expiresAt && record.expiresAt <= new Date()) {
    return NextResponse.json({ error: "Link expirado." }, { status: 410 })
  }

  return NextResponse.redirect(record.targetUrl, 302)
}
