export interface HealthPlanOption {
  id: string;
  name: string;
}

export interface CloserOption {
  id: string;
  name: string;
  avatarImageUrl: string;
}

export interface SdrOption {
  id: string;
  name: string;
  avatarImageUrl: string;
}

export interface GuestCandidateOption {
  id: string;
  name: string;
  email: string;
  avatarImageUrl: string;
}

export interface SubmitPublicLeadPayload {
  teamId: string;
  supabaseId?: string;
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
  assignedTo: string;
  closerId?: string;
  meetingDate?: string;
  meetingTitle?: string;
  meetingNotes?: string;
  extraGuests?: string[];
  isTransfer?: boolean;
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
  teamName: string;
  healthPlans: HealthPlanOption[];
  closers: CloserOption[];
  sdrs: SdrOption[];
  guestCandidates: GuestCandidateOption[];
  timezone: string;
  hasTransferTargets: boolean;
}

export interface PreScheduleSlotsResult {
  occupiedSlots: number[];
}

export interface IPublicLeadFormService {
  getBootstrapData(teamId: string, supabaseId?: string): Promise<PublicLeadFormBootstrapData>;
  getAvailability(teamId: string, closerId: string, date: string, supabaseId?: string): Promise<AvailabilityResult>;
  getPreScheduleSlots(teamId: string, date: string, supabaseId?: string): Promise<PreScheduleSlotsResult>;
  submitLead(payload: SubmitPublicLeadPayload): Promise<SubmitPublicLeadResult>;
}
