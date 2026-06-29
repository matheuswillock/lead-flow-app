import type { LeadStatus } from "@prisma/client";
import {
  filterSelectableStatusLabelsFromGates,
  isTransitionAllowedByGates,
  type LeadStatusTransitionGateRow,
} from "@/lib/leadStatusTransitionGates";
import type { ProductLeadStatusTransitionGate } from "@/lib/services/leadStatusTransitionGatesClient";

export function mapProductGatesToGateRows(
  gates: ProductLeadStatusTransitionGate[]
): LeadStatusTransitionGateRow[] {
  return gates.map((gate, index) => ({
    id: gate.slug,
    slug: gate.slug,
    name: gate.slug,
    gateType: gate.gateType,
    sourceStatus: gate.sourceStatus,
    targetStatus: gate.targetStatus,
    config: gate.config,
    blockerType: "validation_error",
    errorMessage: null,
    isEnabled: true,
    sortOrder: index,
  }));
}

export function isAllowedStatusTransitionFromProductGates(
  gates: ProductLeadStatusTransitionGate[],
  sourceStatus: LeadStatus | string,
  targetStatus: LeadStatus | string
): boolean {
  return isTransitionAllowedByGates(
    mapProductGatesToGateRows(gates),
    sourceStatus as LeadStatus,
    targetStatus as LeadStatus
  );
}

export function filterSelectableStatusLabelsFromProductGates(
  sourceStatus: string,
  statusLabels: Record<string, string>,
  gates: ProductLeadStatusTransitionGate[]
): Array<[string, string]> {
  return filterSelectableStatusLabelsFromGates(
    sourceStatus,
    statusLabels,
    mapProductGatesToGateRows(gates)
  );
}
