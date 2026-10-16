import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import { withCronAudit } from "@/app/api/lib/cron/withCronAudit";
import { getDefaultCronSlackCallback } from "@/app/api/lib/cron/cronSlackCallback";
import { reconcileMeetingSlotReservationsUseCase } from "@/app/api/useCases/teamScheduleSettings/ReconcileMeetingSlotReservationsUseCase";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  await connection();
  try {
    const authorization = request.headers.get("authorization");
    if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 });
    }
    const output = await withCronAudit(
      {
        cronKey: "team-meeting-slot-reservations-reconcile",
        cronPath: "/api/v1/teams/cron/reconcile-meeting-slot-reservations",
      },
      () => reconcileMeetingSlotReservationsUseCase.execute(),
      { onFailure: getDefaultCronSlackCallback() },
    );
    return NextResponse.json(output, { status: output.isValid ? 200 : 500 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[ReconcileMeetingSlotReservationsRoute][GET]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno ao reconciliar reservas"], null), { status: 500 });
  }
}
