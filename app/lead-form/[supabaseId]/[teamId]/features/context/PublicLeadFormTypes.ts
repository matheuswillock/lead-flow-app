import type {
  HealthPlanOption,
  CloserOption,
  SdrOption,
  GuestCandidateOption,
} from "../services/IPublicLeadFormService";

export type BootstrapStatus = "loading" | "ready" | "error";

export interface PublicLeadFormState {
  teamId: string;
  teamName: string;
  legacySupabaseId?: string;
  bootstrapStatus: BootstrapStatus;
  bootstrapError: string | null;
  healthPlans: HealthPlanOption[];
  healthPlansLoading: boolean;
  closers: CloserOption[];
  closersLoading: boolean;
  sdrs: SdrOption[];
  guestCandidates: GuestCandidateOption[];
  timezone: string;
  hasTransferTargets: boolean;
  availableTimes: string[];
  availabilityLoading: boolean;
  preScheduleOccupiedSlots: number[];
  preScheduleSlotsLoading: boolean;
  isSubmitting: boolean;
  isSubmitted: boolean;
}

export interface PublicLeadFormActions {
  fetchAvailability: (closerId: string, date: string) => Promise<void>;
  fetchPreScheduleSlots: (date: string) => Promise<void>;
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
    assignedTo: string;
    closerId?: string;
    meetingDate?: string;
    meetingTitle?: string;
    meetingNotes?: string;
    extraGuests?: string[];
    isTransfer?: boolean;
  }) => Promise<{ isValid: boolean; successMessages: string[]; errorMessages: string[] }>;
  retryBootstrap: () => void;
  resetForm: () => void;
}
