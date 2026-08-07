import { NextRequest, NextResponse, connection } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { prisma } from "@/app/api/infra/data/prisma";
import { sanitizeDocumentDigits } from "@/lib/masks";

export async function GET(request: NextRequest) {
  await connection();

  const teamAccess = await getTeamAccess(request);
  if (teamAccess.error) {
    return NextResponse.json(teamAccess.error, { status: teamAccess.status });
  }

  const cnpj = sanitizeDocumentDigits(new URL(request.url).searchParams.get("cnpj") ?? "");
  if (!cnpj) {
    const output = new Output(false, [], ["CNPJ é obrigatório"], null);
    return NextResponse.json(output, { status: 400 });
  }

  const existing = await prisma.lead.findFirst({
    where: { teamId: teamAccess.access.teamId, cnpj },
    select: { id: true, leadCode: true, name: true },
  });

  if (existing) {
    const output = new Output(false, [], ["Já existe um lead com este CNPJ neste time"], { available: false, existing });
    return NextResponse.json(output, { status: 409 });
  }

  const output = new Output(true, [], [], { available: true });
  return NextResponse.json(output, { status: 200 });
}
