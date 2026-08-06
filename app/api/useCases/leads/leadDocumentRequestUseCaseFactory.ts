import { LeadDocumentRequestUseCase } from "./LeadDocumentRequestUseCase";
import { leadDocumentRequestService } from "@/app/api/services/leadDocumentRequest/LeadDocumentRequestService";

export const leadDocumentRequestUseCase = new LeadDocumentRequestUseCase(
  leadDocumentRequestService
);
