import { NextResponse } from "next/server"
import { assertResend } from "@/lib/email"

export async function POST() {
  try {
  const resend = assertResend()
  const data = await resend.emails.send({
      from: "no-reply@your-domain.com",
      to: ["teste@exemplo.com"],
      subject: "Bem-vindo!",
      html: "<p>Seu acesso foi criado com sucesso.</p>",
    })
    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
