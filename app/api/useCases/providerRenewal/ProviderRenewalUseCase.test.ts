import { describe, expect, it } from "bun:test";
import {
  ProviderRenewalUseCase,
  type IProviderRenewalCandidateSource,
  type IProviderRenewalCharger,
  type ProviderRenewalCandidate,
} from "./ProviderRenewalUseCase";

const NOW = new Date("2026-12-05T12:00:00.000Z");
const DUE_IN_3_DAYS = new Date("2026-12-08T12:00:00.000Z");
const DUE_IN_30_DAYS = new Date("2027-01-04T12:00:00.000Z");

/** Simula a unicidade (conta, chave) do ledger: a segunda chamada com a mesma chave não cobra. */
function createLedgerCharger() {
  const charged = new Set<string>();
  const calls: string[] = [];
  const charger: IProviderRenewalCharger = {
    async chargeCycle({ idempotencyKey }) {
      calls.push(idempotencyKey);
      if (charged.has(idempotencyKey)) return "ALREADY_CHARGED";
      charged.add(idempotencyKey);
      return "CREATED";
    },
  };
  return { charger, charged, calls };
}

function createCandidates(rows: ProviderRenewalCandidate[]): IProviderRenewalCandidateSource {
  return {
    async listRouterDue() {
      return rows;
    },
  };
}

const ROUTER_ROW: ProviderRenewalCandidate = { profileId: "profile-1", dueDate: DUE_IN_3_DAYS, cycle: "monthly" };

describe("ProviderRenewalUseCase", () => {
  it("não cobra nada quando o kill switch está desligado", async () => {
    const ledger = createLedgerCharger();
    const useCase = new ProviderRenewalUseCase({
      candidates: createCandidates([ROUTER_ROW]),
      charger: ledger.charger,
      isEnabled: () => false,
    });

    const summary = await useCase.execute(NOW);

    expect(summary.status).toBe("DISABLED");
    expect(ledger.calls).toHaveLength(0);
  });

  it("idempotência: rodar duas vezes no mesmo ciclo gera uma única cobrança", async () => {
    const ledger = createLedgerCharger();
    const useCase = new ProviderRenewalUseCase({
      candidates: createCandidates([ROUTER_ROW]),
      charger: ledger.charger,
      isEnabled: () => true,
    });

    const first = await useCase.execute(NOW);
    const second = await useCase.execute(NOW);

    expect(first.created).toBe(1);
    expect(second.created).toBe(0);
    expect(second.alreadyCharged).toBe(1);
    expect(ledger.charged.size).toBe(1);
  });

  it("não cobra assinatura com vencimento fora da janela de 5 dias", async () => {
    const ledger = createLedgerCharger();
    const useCase = new ProviderRenewalUseCase({
      candidates: createCandidates([{ profileId: "profile-2", dueDate: DUE_IN_30_DAYS, cycle: "monthly" }]),
      charger: ledger.charger,
      isEnabled: () => true,
    });

    const summary = await useCase.execute(NOW);

    expect(summary.outsideWindow).toBe(1);
    expect(ledger.calls).toHaveLength(0);
  });

  it("falha de uma assinatura não interrompe o lote e não conta como cobrança", async () => {
    const ledger = createLedgerCharger();
    const charger: IProviderRenewalCharger = {
      async chargeCycle(input) {
        if (input.profileId === "broken") throw new Error("provedor indisponível");
        return ledger.charger.chargeCycle(input);
      },
    };
    const useCase = new ProviderRenewalUseCase({
      candidates: createCandidates([
        { profileId: "broken", dueDate: DUE_IN_3_DAYS, cycle: "monthly" },
        ROUTER_ROW,
      ]),
      charger,
      isEnabled: () => true,
    });

    const summary = await useCase.execute(NOW);

    expect(summary.failed).toBe(1);
    expect(summary.created).toBe(1);
  });
});
