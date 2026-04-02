export interface IntegrationsState {
  supabaseId: string;
  leadFormUrl: string;
}

export interface IntegrationsActions {
  copyLeadFormUrl: () => void;
}
