export interface IBackofficePublicLeadFormState {
  isSubmitting: boolean
  isSubmitted: boolean
  submitError: string | null
}

export interface IBackofficePublicLeadFormActions {
  submitLead: (payload: {
    name: string
    email?: string
    phone?: string
    cpfCnpj?: string
    notes?: string
    qualificationLeadOrganization?: string
    qualificationAvgUsers?: string
    qualificationProfileFit?: string
  }) => Promise<boolean>
  resetForm: () => void
}

export type IBackofficePublicLeadFormContext = IBackofficePublicLeadFormState &
  IBackofficePublicLeadFormActions
