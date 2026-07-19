import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';
import {
  calendarAvailabilityUseCase,
  CALENDAR_AVAILABILITY_ERROR_MESSAGES,
} from "@/app/api/useCases/calendarAvailability/CalendarAvailabilityUseCase";

const schema = z
  .object({
    closerId: z.string().uuid().optional(),
    closerIds: z.array(z.string().uuid()).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    days: z.number().int().min(1).max(60).optional(),
    excludeLeadId: z.string().uuid().optional(),
  })
  .refine((data) => data.closerId || (data.closerIds && data.closerIds.length > 0), {
    message: "Informe um closerId ou closerIds.",
    path: ["closerId"],
  });

export async function POST(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const payload = await request.json().catch(() => null);
    const validation = schema.safeParse(payload);

    if (!validation.success) {
      const output = new Output(
        false,
        [],
        validation.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
        null
      );
      return NextResponse.json(output, { status: 400 });
    }

    const { closerId, closerIds, date, days, excludeLeadId } = validation.data;
    const requestedCloserIds = Array.from(
      new Set([...(closerIds ?? []), ...(closerId ? [closerId] : [])])
    );
    const output = await calendarAvailabilityUseCase.getAvailability({
      teamId: teamAccess.access.teamId,
      requestedCloserIds,
      date,
      days,
      excludeLeadId,
      userTimezone: teamAccess.access.userTimezone,
    });

    if (!output.isValid) {
      if (output.errorMessages.includes(CALENDAR_AVAILABILITY_ERROR_MESSAGES.CLOSERS_NOT_IN_TEAM)) {
        return NextResponse.json(output, { status: 403 });
      }

      if (output.errorMessages.includes(CALENDAR_AVAILABILITY_ERROR_MESSAGES.CLOSERS_NOT_FOUND)) {
        return NextResponse.json(output, { status: 404 });
      }

      return NextResponse.json(output, { status: 400 });
    }

    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[CalendarAvailabilityRoute][POST] Erro ao buscar disponibilidade:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
