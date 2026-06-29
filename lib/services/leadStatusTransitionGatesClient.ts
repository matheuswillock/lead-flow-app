import type { LeadStatusTransitionGateRow } from "@/lib/leadStatusTransitionGates";

export type ProductLeadStatusTransitionGate = {
  slug: string;
  gateType: LeadStatusTransitionGateRow["gateType"];
  sourceStatus: LeadStatusTransitionGateRow["sourceStatus"];
  targetStatus: LeadStatusTransitionGateRow["targetStatus"];
  config: unknown;
};

export async function fetchProductTransitionGates(input: {
  supabaseId?: string;
  teamId?: string | null;
}): Promise<ProductLeadStatusTransitionGate[]> {
  const response = await fetch("/api/v1/lead-status-transition-gates", {
    headers: {
      ...(input.supabaseId ? { "x-supabase-user-id": input.supabaseId } : {}),
      ...(input.teamId ? { "x-team-id": input.teamId } : {}),
    },
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.isValid) {
    return [];
  }

  const gates = result.result?.gates;
  return Array.isArray(gates) ? (gates as ProductLeadStatusTransitionGate[]) : [];
}
