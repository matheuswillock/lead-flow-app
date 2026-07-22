import type { SubmitBackofficePublicLeadPayload } from "../services/IBackofficePublicLeadFormService"

export interface IBackofficePublicLeadFormState {
  isSubmitting: boolean
  isSubmitted: boolean
  submitError: string | null
  scheduledMeetingDate: string | null
}

export interface IBackofficePublicLeadFormActions {
  submitLead: (payload: SubmitBackofficePublicLeadPayload) => Promise<boolean>
  resetForm: () => void
}

export type IBackofficePublicLeadFormContext = IBackofficePublicLeadFormState &
  IBackofficePublicLeadFormActions
