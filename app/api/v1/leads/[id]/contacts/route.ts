import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { leadContactsUseCase } from "@/app/api/useCases/leads/LeadContactsUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

const createContactSchema = z.object({
  type: z.enum(["call", "whatsapp", "email", "meeting", "visit", "missed"]),
  body: z.string().min(1).max(5000).optional(),
  outcome: z.string().max(50).optional(),
  duration: z.number().int().min(0).optional(),
  contactDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "contactDate deve ser yyyy-mm-dd").optional(),
  contactTime: z.string().regex(/^\d{2}:\d{2}$/, "contactTime deve ser hh:mm").optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { id: leadId } = await params;
    if (!leadId) {
      const output = new Output(false, [], ["ID do lead é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const result = await leadContactsUseCase.listContacts(
      leadId,
      teamAccess.access.teamId
    );

    if (!result.isValid) {
      const status = result.errorMessages.some((m) => m.includes("não encontrado")) ? 404 : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[LeadContactsRoute][GET] Erro ao listar contatos:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { id: leadId } = await params;
    if (!leadId) {
      const output = new Output(false, [], ["ID do lead é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const body = await request.json();
    const validation = createContactSchema.safeParse(body);
    if (!validation.success) {
      const output = new Output(
        false,
        [],
        validation.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
        null
      );
      return NextResponse.json(output, { status: 400 });
    }

    console.info("[LeadContactsRoute][POST] Criando contato", {
      leadId,
      type: validation.data.type,
    });

    const result = await leadContactsUseCase.createContact(
      leadId,
      teamAccess.access.teamId,
      teamAccess.access.profileId,
      validation.data
    );

    if (!result.isValid) {
      const status = result.errorMessages.some((m) => m.includes("não encontrado")) ? 404 : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[LeadContactsRoute][POST] Erro ao criar contato:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
