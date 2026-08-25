import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { cacheLife, cacheTag } from "next/cache";
import { cacheTags } from "@/lib/cache/cacheTags";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { isManagerLikeRole } from "@/lib/roles";
import { pmePlanSimulatorUseCase, PME_SIMULATOR_ERROR_MESSAGES } from "@/app/api/useCases/pmePlanSimulator/PmePlanSimulatorUseCase";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

const ageRangeCountSchema = z.object({
  rangeKey: z.string(),
  count: z.number().int().min(1),
});

const simulationBodySchema = z.object({
  ages: z.array(z.number().int().min(0).max(99)).min(1, PME_SIMULATOR_ERROR_MESSAGES.INVALID_AGES),
  hospitalId: z.enum(["nenhum", "sirio", "einstein", "rededor"]),
});

const simulationFromRangeCountsBodySchema = z.object({
  ageRangeCounts: z.array(ageRangeCountSchema).min(1, PME_SIMULATOR_ERROR_MESSAGES.INVALID_AGE_RANGE_COUNTS),
  hospitalId: z.enum(["nenhum", "sirio", "einstein", "rededor"]),
});

function hasPmeSimulatorAccess(role: string, functions: string[]) {
  if (isManagerLikeRole(role)) {
    return true;
  }
  return functions.includes("SDR") || functions.includes("CLOSER");
}

/**
 * Catalogo do simulador PME.
 *
 * A fonte sao os arrays constantes PLANS/HOSPITALS em PmePlanSimulatorService.ts —
 * nao ha Prisma nem caminho de escrita, por isso `cacheLife("max")` e nenhum
 * invalidador correspondente em lib/cache/invalidation.ts (seria codigo morto).
 *
 * A tag `pmeSimulator()` existe como alavanca de purge manual e como ponto de
 * engate do TODO de migrar a tabela para o banco (PmePlanSimulatorService.ts).
 * Ao migrar: criar `invalidatePmeSimulatorCache()` e chama-la no CRUD.
 */
async function getCachedPmeCatalog() {
  "use cache";
  cacheTag(cacheTags.pmeSimulator());
  cacheLife("max");

  const output = await pmePlanSimulatorUseCase.getCatalog();
  if (!output.isValid) {
    throw new Error(output.errorMessages.join("; ") || PME_SIMULATOR_ERROR_MESSAGES.INTERNAL_CATALOG_ERROR);
  }
  return output.result;
}

export async function GET(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const canAccess = hasPmeSimulatorAccess(
      teamAccess.access.teamMember.role,
      teamAccess.access.teamMember.functions,
    );

    if (!canAccess) {
      return NextResponse.json(
        new Output(false, [], ["Acesso negado para o simulador de planos."], null),
        { status: 403 },
      );
    }

    const catalog = await getCachedPmeCatalog();
    return NextResponse.json(new Output(true, [], [], catalog), { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[PmePlanSimulatorRoute][GET] Erro:", error);
    return NextResponse.json(
      new Output(false, [], [PME_SIMULATOR_ERROR_MESSAGES.INTERNAL_CATALOG_ERROR], null),
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const canAccess = hasPmeSimulatorAccess(
      teamAccess.access.teamMember.role,
      teamAccess.access.teamMember.functions,
    );

    if (!canAccess) {
      return NextResponse.json(
        new Output(false, [], ["Acesso negado para o simulador de planos."], null),
        { status: 403 },
      );
    }

    const body = await request.json();

    const rangeCountsParsed = simulationFromRangeCountsBodySchema.safeParse(body);
    if (rangeCountsParsed.success) {
      const output = await pmePlanSimulatorUseCase.simulateFromRangeCounts(rangeCountsParsed.data);
      return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
    }

    const parsed = simulationBodySchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((issue) => issue.message);
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 });
    }

    const output = await pmePlanSimulatorUseCase.simulate(parsed.data);
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[PmePlanSimulatorRoute][POST] Erro:", error);
    return NextResponse.json(
      new Output(false, [], [PME_SIMULATOR_ERROR_MESSAGES.INTERNAL_SIMULATION_ERROR], null),
      { status: 500 },
    );
  }
}

