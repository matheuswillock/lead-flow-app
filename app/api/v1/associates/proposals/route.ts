import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getAssociateBackofficeAccess } from "@/app/api/v1/associates/utils/getAssociateBackofficeAccess";
import { associateProposalUseCase } from "@/app/api/useCases/associateProposal/AssociateProposalUseCase";

const listSchema = z.object({
  associateAccountId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  closerId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export async function GET(request: NextRequest) {
  try {
    const accessResult = await getAssociateBackofficeAccess(request);
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status });
    }

    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const parsed = listSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(new Output(false, [], ["Parâmetros inválidos"], null), { status: 400 });
    }

    const output = await associateProposalUseCase.list(accessResult.access, {
      associateAccountId: parsed.data.associateAccountId,
      teamId: parsed.data.teamId,
      closerId: parsed.data.closerId,
      from: parseDate(parsed.data.from),
      to: parseDate(parsed.data.to),
      search: parsed.data.search,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    console.error("[AssociateProposalsRoute][GET]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
