import type { NextRequest } from "next/server";
import { associateBackofficeAccessUseCase } from "@/app/api/useCases/associateProposal/AssociateBackofficeAccessUseCase";

export type {
  AssociateBackofficeAccess,
  AssociateBackofficeAccessResult,
} from "@/app/api/useCases/associateProposal/AssociateBackofficeAccessTypes";

export async function getAssociateBackofficeAccess(request: NextRequest) {
  return associateBackofficeAccessUseCase.resolve(request);
}
