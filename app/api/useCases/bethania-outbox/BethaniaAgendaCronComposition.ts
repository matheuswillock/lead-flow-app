import { bethaniaAgendaRepository } from "@/app/api/infra/data/repositories/bethania-outbox/PrismaBethaniaAgendaRepository";
import { createBethaniaOutboxService } from "@/app/api/services/bethania-outbox/BethaniaOutboxService";
import { BethaniaAgendaDispatchService } from "@/app/api/services/bethania-outbox/BethaniaAgendaDispatchService";
import { BethaniaAgendaWorkerUseCase } from "@/app/api/useCases/bethania-outbox/BethaniaAgendaWorkerUseCase";
import { backofficeBethaniaUseCase } from "@/app/api/useCases/backofficeBethania/BackofficeBethaniaUseCase";
import { createBethaniaAgendaCronHandler } from "./BethaniaAgendaCronHandler";

export async function handleBethaniaAgendaCron(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret?.trim() || request.headers.get("authorization") !== `Bearer ${secret.trim()}`) {
    return Response.json({ ok: false, error: "not_authorized" }, { status: 401 });
  }
  try {
    const senderUrl = (await backofficeBethaniaUseCase.getConfiguredSenderUrl()) ?? "";
    const senderSecret = process.env.BETHANIA_SENDER_SECRET ?? "";
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
      || (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");
    const worker = new BethaniaAgendaWorkerUseCase(
      new BethaniaAgendaDispatchService(bethaniaAgendaRepository, appBaseUrl),
      createBethaniaOutboxService({ baseUrl: senderUrl, secret: senderSecret }),
      Boolean(senderUrl && senderSecret),
    );
    return await createBethaniaAgendaCronHandler({ secret, worker })(request);
  } catch {
    return Response.json({ ok: false, error: "worker_failed" }, { status: 500 });
  }
}
