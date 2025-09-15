import { NextResponse } from "next/server"
import { assertResend } from "@/lib/email"
import { Output } from "@/lib/output"

export async function POST() {
  try {
  const resend = assertResend()
  const data = await resend.emails.send({
      from: "no-reply@your-domain.com",
      to: ["teste@exemplo.com"],
      subject: "Bem-vindo!",
      html: "<p>Seu acesso foi criado com sucesso.</p>",
    })
    const output = new Output(true, ["Email sent successfully"], [], data);
    return NextResponse.json(output, { status: 200 })
  } catch (e: any) {
    const output = new Output(false, [], [e.message], null);
    return NextResponse.json(output, { status: 500 })
  }
}
