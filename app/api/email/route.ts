import { NextRequest, NextResponse } from "next/server"
import { emailService } from "@/lib/services/EmailService"
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

    // Usar EmailService para respeitar EMAIL_TEST_MODE
    const result = await emailService.sendEmail({
      from: body.from || "Corretor Studio <no-reply@corretorstudio.com>",
      to: body.to,
      subject: body.subject,
      html: body.html,
      text: body.text,
    });

    if (!result.success) {
      const output = new Output(false, [], [result.error || "Erro ao enviar email"], null);
      return NextResponse.json(output, { status: 500 });
    }

    const output = new Output(true, ["Email enviado com sucesso"], [], result.data);
    return NextResponse.json(output, { status: 200 });
    
  } catch (e: any) {
    console.error("Erro ao enviar email:", e);
    const output = new Output(false, [], [e.message || "Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
