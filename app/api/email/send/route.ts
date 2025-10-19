import { NextRequest, NextResponse } from "next/server";
import { getEmailService } from "@/lib/services/EmailService";
import { Output } from "@/lib/output";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, ...data } = body;

    const emailService = getEmailService();
    let result;

    switch (type) {
      case 'welcome':
        if (!data.userName || !data.userEmail) {
          const output = new Output(false, [], ["userName e userEmail são obrigatórios"], null);
          return NextResponse.json(output, { status: 400 });
        }
        result = await emailService.sendWelcomeEmail(data);
        break;

      case 'lead-notification':
        if (!data.leadName || !data.leadEmail || !data.managerName || !data.managerEmail) {
          const output = new Output(false, [], ["leadName, leadEmail, managerName e managerEmail são obrigatórios"], null);
          return NextResponse.json(output, { status: 400 });
        }
        result = await emailService.sendLeadNotification(data);
        break;

      case 'password-reset':
        if (!data.userEmail || !data.userName || !data.resetUrl) {
          const output = new Output(false, [], ["userEmail, userName e resetUrl são obrigatórios"], null);
          return NextResponse.json(output, { status: 400 });
        }
        result = await emailService.sendPasswordResetEmail(data.userEmail, data.userName, data.resetUrl);
        break;

      case 'custom':
        if (!data.to || !data.subject || (!data.html && !data.text)) {
          const output = new Output(false, [], ["to, subject e (html ou text) são obrigatórios"], null);
          return NextResponse.json(output, { status: 400 });
        }
        result = await emailService.sendEmail(data);
        break;

      case 'subscription-confirmation':
        // required: userName, userEmail; optional: subscriptionId, planName, value, nextDueDate, manageUrl
        if (!data.userName || !data.userEmail) {
          const output = new Output(false, [], ["userName e userEmail são obrigatórios"], null);
          return NextResponse.json(output, { status: 400 });
        }
        result = await emailService.sendSubscriptionConfirmationEmail({
          userName: data.userName,
          userEmail: data.userEmail,
          subscriptionId: data.subscriptionId,
          planName: data.planName,
          value: data.value,
          nextDueDate: data.nextDueDate,
          manageUrl: data.manageUrl,
        });
        break;

      default:
  const output = new Output(false, [], ["Tipo de email inválido. Use: welcome, lead-notification, password-reset, subscription-confirmation ou custom"], null);
        return NextResponse.json(output, { status: 400 });
    }

    if (result.success) {
      const output = new Output(true, ["Email enviado com sucesso"], [], result.data);
      return NextResponse.json(output, { status: 200 });
    } else {
      const output = new Output(false, [], [result.error], null);
      return NextResponse.json(output, { status: 500 });
    }

  } catch (error: any) {
    console.error("Erro na rota de email:", error);
    const output = new Output(false, [], [error.message || "Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

export async function GET() {
  const examples = {
    welcome: {
      type: "welcome",
      userName: "João Silva",
      userEmail: "joao@exemplo.com",
      loginUrl: "https://seuapp.com/login"
    },
    leadNotification: {
      type: "lead-notification",
      leadName: "Maria Santos",
      leadEmail: "maria@exemplo.com",
      leadPhone: "(11) 99999-9999",
      managerName: "João Silva",
      managerEmail: "joao@exemplo.com"
    },
    passwordReset: {
      type: "password-reset",
      userEmail: "joao@exemplo.com",
      userName: "João Silva",
      resetUrl: "https://seuapp.com/reset-password?token=abc123"
    },
    custom: {
      type: "custom",
      to: ["destinatario@exemplo.com"],
      subject: "Assunto do email",
      html: "<h1>Olá!</h1><p>Este é um email personalizado.</p>",
      text: "Olá! Este é um email personalizado."
    }
  };

  const output = new Output(true, ["Exemplos de uso da API de email"], [], examples);
  return NextResponse.json(output, { status: 200 });
}