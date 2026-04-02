import type { HealthPlanOption, CloserOption } from "../services/IPublicLeadFormService";

export interface PublicLeadFormState {
  supabaseId: string;
  teamId: string;
  healthPlans: HealthPlanOption[];
  healthPlansLoading: boolean;
  closers: CloserOption[];
  closersLoading: boolean;
  availableTimes: string[];
  availabilityLoading: boolean;
  isSubmitting: boolean;
  isSubmitted: boolean;
}

export interface PublicLeadFormActions {
  fetchAvailability: (closerId: string, date: string) => Promise<void>;
  submitLead: (data: {
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
  }) => Promise<{ isValid: boolean; successMessages: string[]; errorMessages: string[] }>;
  resetForm: () => void;
}
