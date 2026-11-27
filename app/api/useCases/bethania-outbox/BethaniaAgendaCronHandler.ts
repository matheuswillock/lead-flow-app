import type { Output } from "@/lib/output";

export type BethaniaAgendaCronWorker = { run(now: Date): Promise<Output> };

export function createBethaniaAgendaCronHandler(dependencies: {
  secret: string | undefined;
  worker: BethaniaAgendaCronWorker;
  now?: () => Date;
}) {
  return async (request: Request): Promise<Response> => {
    const secret = dependencies.secret?.trim();
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
      return Response.json({ ok: false, error: "not_authorized" }, { status: 401 });
    }
    try {
      const result = await dependencies.worker.run((dependencies.now ?? (() => new Date()))());
      return Response.json({ ok: true, result: result.result }, { status: 200 });
    } catch {
      return Response.json({ ok: false, error: "worker_failed" }, { status: 500 });
    }
  };
}
