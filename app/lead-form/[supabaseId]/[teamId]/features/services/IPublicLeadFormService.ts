export interface HealthPlanOption {
  id: string;
  name: string;
}

export interface CloserOption {
  id: string;
  name: string;
  avatarImageUrl: string;
}

export interface SubmitPublicLeadPayload {
  supabaseId: string;
  teamId: string;
  name: string;
  email: string;
  phone: string;
  cnpj?: string;
  age: string;
  currentHealthPlan: string;
  currentValue?: number;
  referenceHospital: string;
  currentTreatment: string;
  notes?: string;
  closerId?: string;
  meetingDate?: string;
  meetingTitle?: string;
  meetingNotes?: string;
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  landingUrl?: string;
  referrer?: string;
}

export interface SubmitPublicLeadResult {
  isValid: boolean;
  successMessages: string[];
  errorMessages: string[];
}

export interface AvailabilityResult {
  availableTimes: string[];
  source: "google" | "internal";
}

export interface PublicLeadFormBootstrapData {
  healthPlans: HealthPlanOption[];
  closers: CloserOption[];
}

export interface IPublicLeadFormService {
  getBootstrapData(supabaseId: string, teamId: string): Promise<PublicLeadFormBootstrapData>;
  getAvailability(supabaseId: string, teamId: string, closerId: string, date: string): Promise<AvailabilityResult>;
  submitLead(payload: SubmitPublicLeadPayload): Promise<SubmitPublicLeadResult>;
}
