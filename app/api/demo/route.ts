import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { isValidPhone } from "@/lib/masks";
import { backofficeDemoLeadUseCase } from "@/app/api/useCases/backofficeDemoLead/BackofficeDemoLeadUseCase";

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

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

    const result = await backofficeDemoLeadUseCase.create({
      name: fullName,
      email,
      phone: whatsapp,
    });

    if (!result.isValid) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    console.error("[DemoRoute][POST] Erro ao registrar lead de demonstração:", error);
    const message = error instanceof Error ? error.message : "Erro interno do servidor";
    const output = new Output(false, [], [message], null);
    return NextResponse.json(output, { status: 500 });
  }
}
