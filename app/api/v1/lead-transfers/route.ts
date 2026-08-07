import { NextRequest, NextResponse, connection } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getTeamAccess, isManagerOrMaster } from "@/app/api/v1/utils/teamAccess";
import { leadTransferUseCase } from "@/app/api/useCases/leadTransfers/LeadTransferUseCase";
import { leadStatusLabels } from "@/lib/lead-status";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';
import {
  isMultiskillOriginMaster,
  resolveMultiskillOriginMasterId,
} from "@/lib/multiskill/is-multiskill-origin-master";

const leadStatusValues = Object.keys(leadStatusLabels) as [string, ...string[]];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const listSchema = z.object({
  search: z.string().optional(),
  transferStatuses: z.string().optional(),
  multiskillOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  leadStatus: z.enum(leadStatusValues).optional(),
  toTeamIds: z.string().optional(),
  transferredByProfileIds: z.string().optional(),
  sdrProfileIds: z.string().optional(),
  closerProfileIds: z.string().optional(),
  transferDateFrom: z.string().optional(),
  transferDateTo: z.string().optional(),
  preScheduledDateFrom: z.string().optional(),
  preScheduledDateTo: z.string().optional(),
  scheduledDateFrom: z.string().optional(),
  scheduledDateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const ISO_DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function splitCsv(value?: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitUuidCsv(value?: string): string[] {
  return splitCsv(value).filter((item) => UUID_RE.test(item));
}

function splitTransferStatuses(value?: string): Array<"pending" | "completed"> {
  const allowed = new Set(["pending", "completed"]);
  return splitCsv(value).filter(
    (item): item is "pending" | "completed" => allowed.has(item)
  );
}

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
  await connection();

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

    if (parsed.data.multiskillOnly) {
      const originMasterId = await resolveMultiskillOriginMasterId();
      if (!isMultiskillOriginMaster(teamAccess.access, originMasterId)) {
        return NextResponse.json(
          new Output(
            false,
            [],
            ["Acesso negado: conta não autorizada para filtro MultiSkill"],
            null
          ),
          { status: 403 }
        );
      }
    }

    const output = await leadTransferUseCase.listWithCtx(teamAccess.access, {
      search: parsed.data.search,
      transferStatuses: splitTransferStatuses(parsed.data.transferStatuses),
      multiskillOnly: parsed.data.multiskillOnly,
      leadStatus: parsed.data.leadStatus,
      toTeamIds: splitUuidCsv(parsed.data.toTeamIds),
      transferredByProfileIds: splitUuidCsv(parsed.data.transferredByProfileIds),
      sdrProfileIds: splitUuidCsv(parsed.data.sdrProfileIds),
      closerProfileIds: splitUuidCsv(parsed.data.closerProfileIds),
      transferDateFrom: parseDateBound(parsed.data.transferDateFrom, "start"),
      transferDateTo: parseDateBound(parsed.data.transferDateTo, "end"),
      preScheduledDateFrom: parseDateBound(parsed.data.preScheduledDateFrom, "start"),
      preScheduledDateTo: parseDateBound(parsed.data.preScheduledDateTo, "end"),
      scheduledDateFrom: parseDateBound(parsed.data.scheduledDateFrom, "start"),
      scheduledDateTo: parseDateBound(parsed.data.scheduledDateTo, "end"),
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[LeadTransfersRoute][GET] Erro ao listar transferências:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno do servidor"], null),
      { status: 500 }
    );
  }
}
