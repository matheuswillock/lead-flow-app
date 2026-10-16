import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { leadScheduleUseCase } from "@/app/api/useCases/leads/LeadScheduleUseCase";
import { Output } from "@/lib/output";
import { getTeamAccess, hasLeadAccess } from "@/app/api/v1/utils/teamAccess";
import { validateMeetingLinkValue } from "@/lib/validations/meetingLink";
import { invalidateTeamCalendarCache } from "@/lib/cache/invalidation";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

const scheduleSchema = z.object({
  date: z.string().datetime().optional(),
  meetingTitle: z.string().optional(),
  notes: z.string().optional(),
  meetingLink: z.string().optional(),
  meetingType: z.enum(["online", "call", "whatsapp"]).optional(),
  closerId: z.string().uuid("ID do closer deve ser um UUID válido").optional(),
  extraGuests: z.array(z.string().email("Email inválido")).optional(),
  transitionStatusToScheduled: z.boolean().optional(),
  confirmNoShowSchedule: z.boolean().optional(),
});

function denied() {
  return NextResponse.json(
    new Output(false, [], ["Acesso negado: função SDR necessária para visualizar leads."], null),
    { status: 403 },
  );
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    if (!hasLeadAccess(teamAccess.access.teamMember)) return denied();

    const parsed = scheduleSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        new Output(false, [], parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`), null),
        { status: 400 },
      );
    }
    const { id: leadId } = await params;
    if (!leadId) return NextResponse.json(new Output(false, [], ["ID do lead é obrigatório"], null), { status: 400 });

    const link = validateMeetingLinkValue(parsed.data.meetingLink, { required: false });
    if (!link.isValid) return NextResponse.json(new Output(false, [], [link.error], null), { status: 400 });

    const output = await leadScheduleUseCase.execute({
      leadId,
      access: teamAccess.access,
      ...parsed.data,
      meetingLink: link.normalized,
    });
    if (!output.isValid) {
      const conflict = output.errorMessages.includes("Este horário não está mais disponível.");
      return NextResponse.json(output, { status: conflict ? 409 : 400 });
    }
    invalidateTeamCalendarCache({ teamId: teamAccess.access.teamId, leadId });
    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[LeadScheduleRoute][POST]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno do servidor"], null), { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    if (!hasLeadAccess(teamAccess.access.teamMember)) return denied();
    const { id: leadId } = await params;
    if (!leadId) return NextResponse.json(new Output(false, [], ["ID do lead é obrigatório"], null), { status: 400 });

    const output = await leadScheduleUseCase.get(leadId, teamAccess.access);
    return NextResponse.json(output, { status: output.isValid ? 200 : 404 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[LeadScheduleRoute][GET]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno do servidor"], null), { status: 500 });
  }
}
