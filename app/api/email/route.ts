import { NextRequest, NextResponse } from "next/server"
import { assertResend } from "@/lib/email"
import { Output } from "@/lib/output"

interface EmailRequest {
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: EmailRequest = await request.json();
    
    // Validação básica
    if (!body.to || !Array.isArray(body.to) || body.to.length === 0) {
      const output = new Output(false, [], ["Campo 'to' é obrigatório e deve ser um array"], null);
      return NextResponse.json(output, { status: 400 });
    }
    
    if (!body.subject) {
      const output = new Output(false, [], ["Campo 'subject' é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }
    
    if (!body.html && !body.text) {
      const output = new Output(false, [], ["É necessário fornecer 'html' ou 'text'"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const resend = assertResend();
    
    // Preparar dados do email
    const emailData: any = {
      from: body.from || "Lead Flow <noreply@leadflow.com>",
      to: body.to,
      subject: body.subject,
    };

    // Adicionar conteúdo (html ou text)
    if (body.html) {
      emailData.html = body.html;
    }
    if (body.text) {
      emailData.text = body.text;
    }

    const data = await resend.emails.send(emailData);

    const output = new Output(true, ["Email enviado com sucesso"], [], data);
    return NextResponse.json(output, { status: 200 });
    
  } catch (e: any) {
    console.error("Erro ao enviar email:", e);
    const output = new Output(false, [], [e.message || "Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
