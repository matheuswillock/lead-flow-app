import { describe, expect, it, mock } from "bun:test";
import { Output } from "@/lib/output";
import { createBethaniaAgendaCronHandler } from "./BethaniaAgendaCronHandler";

describe("createBethaniaAgendaCronHandler", () => {
  it("rejects missing configuration and invalid bearer tokens before work", async () => {
    const run = mock(async () => new Output(true, [], [], { ok: true }));
    const handler = createBethaniaAgendaCronHandler({ secret: "", worker: { run } as never });
    const response = await handler(new Request("http://localhost/api", { headers: { authorization: "Bearer wrong" } }));
    expect(response.status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("runs with the exact bearer token and returns the worker result", async () => {
    const run = mock(async (now: Date) => new Output(true, [], [], { at: now.toISOString() }));
    const handler = createBethaniaAgendaCronHandler({ secret: "test-secret", worker: { run } as never, now: () => new Date("2026-11-23T10:00:00.000Z") });
    const response = await handler(new Request("http://localhost/api", { headers: { authorization: "Bearer test-secret" } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, result: { at: "2026-11-23T10:00:00.000Z" } });
  });

  it("sanitizes internal errors", async () => {
    const handler = createBethaniaAgendaCronHandler({ secret: "test-secret", worker: { run: mock(async () => { throw new Error("secret-bearing detail"); }) } as never });
    const response = await handler(new Request("http://localhost/api", { headers: { authorization: "Bearer test-secret" } }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false, error: "worker_failed" });
  });
});
