import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getTeamAccess, isManagerOrMaster } from "@/app/api/v1/utils/teamAccess";
import { leadTransferUseCase } from "@/app/api/useCases/leadTransfers/LeadTransferUseCase";
import { leadStatusLabels } from "@/lib/lead-status";

const leadStatusValues = Object.keys(leadStatusLabels) as [string, ...string[]];

const listSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["pending", "completed", "all"]).default("all"),
  leadStatus: z.enum(leadStatusValues).optional(),
  toTeamId: z.string().uuid().optional(),
  transferredByProfileId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const ISO_DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseDateBound(value: string | undefined, bound: "start" | "end"): Date | undefined {
  if (!value) return undefined;

  if (ISO_DATE_ONLY_REGEX.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const base = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    if (bound === "end") {
      base.setUTCDate(base.getUTCDate() + 1);
    }
    return base;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export async function GET(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    if (!isManagerOrMaster(teamAccess.access)) {
      return NextResponse.json(
        new Output(
          false,
          [],
          ["Acesso negado: somente Master, Manager ou Backoffice podem visualizar transferências"],
          null
        ),
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const parsed = listSchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsed.success) {
      return NextResponse.json(
        new Output(false, [], [parsed.error.issues[0]?.message ?? "Parâmetros inválidos"], null),
        { status: 400 }
      );
    }

    const output = await leadTransferUseCase.listWithCtx(teamAccess.access, {
      search: parsed.data.search,
      status: parsed.data.status,
      leadStatus: parsed.data.leadStatus,
      toTeamId: parsed.data.toTeamId,
      transferredByProfileId: parsed.data.transferredByProfileId,
      dateFrom: parseDateBound(parsed.data.dateFrom, "start"),
      dateTo: parseDateBound(parsed.data.dateTo, "end"),
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    console.error("[LeadTransfersRoute][GET] Erro ao listar transferências:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno do servidor"], null),
      { status: 500 }
    );
  }
}
