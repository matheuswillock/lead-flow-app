import { Output } from "@/lib/output";
import type { PublicLeadFormRequest } from "../../v1/integrations/lead-form/DTO/requestPublicLeadForm";

export interface PublicLeadFormOriginContext {
  source: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  landingUrl?: string;
  referrer?: string;
  userAgent?: string;
  ip?: string;
  submittedAt?: string;
}

export interface IPublicLeadFormUseCase {
  createPublicLead(data: PublicLeadFormRequest, originContext?: PublicLeadFormOriginContext): Promise<Output>;
  getPublicFormBootstrap(supabaseId: string, teamId: string): Promise<Output>;
  getTeamClosers(supabaseId: string, teamId: string): Promise<Output>;
  getCloserAvailability(supabaseId: string, teamId: string, closerId: string, date: string): Promise<Output>;
}
