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
  getPublicFormBootstrap(teamId: string, legacySupabaseId?: string): Promise<Output>;
  getTeamClosers(teamId: string, legacySupabaseId?: string): Promise<Output>;
  getCloserAvailability(
    teamId: string,
    closerId: string,
    date: string,
    legacySupabaseId?: string,
    slotMinutes?: number,
  ): Promise<Output>;
  getPreScheduleSlots(teamId: string, date: string, legacySupabaseId?: string): Promise<Output>;
}
