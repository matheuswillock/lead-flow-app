import { afterEach, beforeAll, describe, expect, it, mock } from "bun:test";
import { useEffect, useState } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

/**
 * Achado de revisão R15-20 (SPEC 15, protocolo 96).
 *
 * Sequência: time A carrega e termina (sucesso). Troca para B (fetch
 * dispara, ainda pendente). Volta para A antes de B responder. O retorno
 * antecipado por cache (`lastSuccessfulKeyRef.current === requestKey`) saía
 * sem `setLoading(false)` — como o fetch de B nunca resolve com
 * `currentKeyRef === "B"` (já voltou para "A"), o `finally` de B também não
 * limpa `loading`, e o card fica preso no Skeleton até a página remontar.
 */

let mockActiveTeamId: string | null = "team-a";
const listeners = new Set<() => void>();
function setMockActiveTeamId(id: string | null) {
  mockActiveTeamId = id;
  listeners.forEach((listener) => listener());
}

mock.module("@/app/context/TeamContext", () => ({
  useTeamContext: () => {
    const [, forceRender] = useState(0);
    useEffect(() => {
      const listener = () => forceRender((n) => n + 1);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }, []);
    return { activeTeamId: mockActiveTeamId };
  },
}));

interface PendingCall {
  teamId: string;
  resolved: boolean;
  resolve: (total: number) => void;
}

class QueuedTeamWebhooksService {
  calls: PendingCall[] = [];

  list(_supabaseId: string, teamId: string, _params: { direction: string; status?: string }) {
    return new Promise<{ items: never[]; total: number; page: number; pageSize: number }>((resolve) => {
      const call: PendingCall = {
        teamId,
        resolved: false,
        resolve: (total: number) => resolve({ items: [], total, page: 1, pageSize: 1 }),
      };
      this.calls.push(call);
    });
  }

  /** Resolve todas as chamadas ainda pendentes de um time, com o mesmo total. */
  resolveAllFor(teamId: string, total: number) {
    for (const call of this.calls) {
      if (call.teamId === teamId && !call.resolved) {
        call.resolved = true;
        call.resolve(total);
      }
    }
  }

  pendingCountFor(teamId: string) {
    return this.calls.filter((call) => call.teamId === teamId && !call.resolved).length;
  }
}

const queuedService = new QueuedTeamWebhooksService();

mock.module("../services/TeamWebhooksService", () => ({
  teamWebhooksService: queuedService,
}));

const { useWebhooksEntry } = await import("./WebhooksEntryHook");

function RaceHarness({ supabaseId }: { supabaseId: string }) {
  const { loading, inboundSummary } = useWebhooksEntry(supabaseId);
  return (
    <div>
      <span data-testid="loading">{loading ? "loading" : "idle"}</span>
      <span data-testid="inbound-total">{inboundSummary.total}</span>
    </div>
  );
}

describe("useWebhooksEntry — corrida de troca de time (R15-20)", () => {
  afterEach(() => {
    cleanup();
    queuedService.calls = [];
  });

  beforeAll(() => {
    mockActiveTeamId = "team-a";
  });

  it("não fica preso em loading quando volta pro time anterior antes da troca terminar", async () => {
    render(<RaceHarness supabaseId="supabase-1" />);

    // Carga inicial do time A — resolve com sucesso.
    await waitFor(() => expect(queuedService.pendingCountFor("team-a")).toBe(6));
    queuedService.resolveAllFor("team-a", 3);
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("idle"));
    expect(screen.getByTestId("inbound-total").textContent).toBe("3");

    // Troca para B — dispara fetch, mas NÃO resolve ainda.
    setMockActiveTeamId("team-b");
    await waitFor(() => expect(queuedService.pendingCountFor("team-b")).toBe(6));
    expect(screen.getByTestId("loading").textContent).toBe("loading");

    // Volta para A antes de B responder — bate no cache (lastSuccessfulKeyRef === "team-a").
    setMockActiveTeamId("team-a");

    // O card não pode ficar preso em loading: já existe dado bom de A em cache.
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("idle"));

    // B responde tarde — não pode sobrescrever o estado de A nem deixar loading travado.
    queuedService.resolveAllFor("team-b", 99);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByTestId("loading").textContent).toBe("idle");
    expect(screen.getByTestId("inbound-total").textContent).toBe("3");
  });
});
