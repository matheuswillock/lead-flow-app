import type { Output } from "@/lib/output";
import type { PmeSimulationOutput, PmeSimulatorCatalog } from "../context/PmeSimulatorTypes";
import type { IPmeSimulatorService } from "./IPmeSimulatorService";

class PmeSimulatorService implements IPmeSimulatorService {
  async getCatalog(input: { supabaseId: string; teamId: string }): Promise<PmeSimulatorCatalog> {
    const response = await fetch("/api/v1/pme-plan-simulator", {
      method: "GET",
      headers: {
        "x-supabase-user-id": input.supabaseId,
        "x-team-id": input.teamId,
      },
      cache: "no-store",
    });

    const output = (await response.json()) as Output;
    if (!response.ok || !output.isValid) {
      throw new Error(output.errorMessages?.[0] ?? "Erro ao carregar catalogo do simulador.");
    }

    return output.result as PmeSimulatorCatalog;
  }

  async simulate(input: {
    supabaseId: string;
    teamId: string;
    ages: number[];
    hospitalId: "nenhum" | "sirio" | "einstein" | "rededor";
  }): Promise<PmeSimulationOutput> {
    const response = await fetch("/api/v1/pme-plan-simulator", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-supabase-user-id": input.supabaseId,
        "x-team-id": input.teamId,
      },
      body: JSON.stringify({
        ages: input.ages,
        hospitalId: input.hospitalId,
      }),
    });

    const output = (await response.json()) as Output;
    if (!response.ok || !output.isValid) {
      throw new Error(output.errorMessages?.[0] ?? "Erro ao simular planos.");
    }

    return output.result as PmeSimulationOutput;
  }
}

export const pmeSimulatorService = new PmeSimulatorService();

