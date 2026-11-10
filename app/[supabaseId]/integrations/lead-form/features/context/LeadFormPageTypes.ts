export interface LeadFormPageState {
  hasLeadFormAccess: boolean;
  isLoading: boolean;
  leadFormUrl: string;
  leadFormFullUrl: string;
}

export interface LeadFormPageActions {
  copyLeadFormUrl: () => void;
}
