import {
  RENEWAL_LEAD_DAYS,
  isInRenewalWindow,
  renewalIdempotencyKey,
} from "@/lib/payment-provider/renewal-cycle";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ProviderRenewalCandidate = {
  readonly profileId: string;
  readonly dueDate: Date;
  readonly cycle: string | null;
};

/** Assinaturas da coorte do roteador cujo vencimento cai até `dueBefore`. Nunca inclui Asaas. */
export interface IProviderRenewalCandidateSource {
  listRouterDue(input: { readonly dueBefore: Date; readonly limit: number }): Promise<ProviderRenewalCandidate[]>;
}

/**
 * Cria a cobrança do ciclo pelo roteador. Retorna `ALREADY_CHARGED` quando a chave do ciclo já
 * existe no ledger: essa é a barreira de idempotência, não a memória do cron.
 */
export interface IProviderRenewalCharger {
  chargeCycle(input: {
    readonly profileId: string;
    readonly dueDate: Date;
    readonly cycle: string | null;
    readonly idempotencyKey: string;
  }): Promise<"CREATED" | "ALREADY_CHARGED">;
}

export type ProviderRenewalSummary = {
  readonly status: "DISABLED" | "RAN";
  readonly created: number;
  readonly alreadyCharged: number;
  readonly outsideWindow: number;
  readonly failed: number;
};

export class ProviderRenewalUseCase {
  constructor(
    private readonly deps: {
      readonly candidates: IProviderRenewalCandidateSource;
      readonly charger: IProviderRenewalCharger;
      /** Kill switch lido em um único ponto (`isProviderRenewalEnabled`), injetado para teste. */
      readonly isEnabled: () => boolean;
      readonly batchSize?: number;
    },
  ) {}

  async execute(now: Date): Promise<ProviderRenewalSummary> {
    if (!this.deps.isEnabled()) {
      return { status: "DISABLED", created: 0, alreadyCharged: 0, outsideWindow: 0, failed: 0 };
    }

    const dueBefore = new Date(now.getTime() + RENEWAL_LEAD_DAYS * DAY_MS);
    const candidates = await this.deps.candidates.listRouterDue({
      dueBefore,
      limit: this.deps.batchSize ?? 100,
    });

    const summary = { status: "RAN" as const, created: 0, alreadyCharged: 0, outsideWindow: 0, failed: 0 };
    for (const candidate of candidates) {
      if (!isInRenewalWindow(candidate.dueDate, now)) {
        summary.outsideWindow += 1;
        continue;
      }
      try {
        const outcome = await this.deps.charger.chargeCycle({
          profileId: candidate.profileId,
          dueDate: candidate.dueDate,
          cycle: candidate.cycle,
          idempotencyKey: renewalIdempotencyKey(candidate),
        });
        if (outcome === "CREATED") summary.created += 1;
        else summary.alreadyCharged += 1;
      } catch (error) {
        // Uma assinatura com falha não interrompe o lote; a próxima execução tenta de novo pela mesma chave.
        summary.failed += 1;
        console.error("[ProviderRenewalUseCase] falha ao cobrar ciclo:", error instanceof Error ? error.name : "erro");
      }
    }
    return summary;
  }
}
