import { NextRequest, NextResponse } from "next/server";
import { emailService } from "@/lib/services/EmailService";
import { Output } from "@/lib/output";
import { isValidPhone } from "@/lib/masks";

const RECIPIENTS = ["matheuswillock@gmail.com", "bruno@onsidemarketing.com.br"];
const SUBJECT = "[URGENTE] Novo lead para demonstração do Corretor Studio";

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fullName = String(body?.fullName || "").trim();
    const email = String(body?.email || "").trim();
    const whatsapp = String(body?.whatsapp || "").trim();

    const errors: string[] = [];
    if (!fullName) errors.push("Nome completo é obrigatório");
    if (!email || !isValidEmail(email)) errors.push("Email inválido");
    if (!whatsapp || !isValidPhone(whatsapp)) errors.push("WhatsApp inválido");

    if (errors.length > 0) {
      const output = new Output(false, [], errors, null);
      return NextResponse.json(output, { status: 400 });
    }

    const safeName = escapeHtml(fullName);
    const safeEmail = escapeHtml(email);
    const safeWhatsapp = escapeHtml(whatsapp);

    const html = `
      <h2>Novo lead para demonstração</h2>
      <p><strong>Nome:</strong> ${safeName}</p>
      <p><strong>E-mail:</strong> ${safeEmail}</p>
      <p><strong>WhatsApp:</strong> ${safeWhatsapp}</p>
    `;
    const text = `Novo lead para demonstração\nNome: ${fullName}\nE-mail: ${email}\nWhatsApp: ${whatsapp}`;

    const result = await emailService.sendEmail({
      to: RECIPIENTS,
      subject: SUBJECT,
      html,
      text,
    });

    if (!result.success) {
      const output = new Output(false, [], [result.error || "Erro ao enviar email"], null);
      return NextResponse.json(output, { status: 500 });
    }

    const output = new Output(true, ["Email enviado com sucesso"], [], result.data);
    return NextResponse.json(output, { status: 200 });
  } catch (error: any) {
    console.error("Erro ao enviar lead de demonstração:", error);
    const output = new Output(false, [], [error?.message || "Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
