type Lead = {
  id: string;
  name: string;
  enteredAt: string; // ISO date (yyyy-mm-dd)
  responsible: string; // responsável pelo lead
};

type ColumnKey =
  | "new_opportunity"
  | "scheduled"
  | "no_show"
  | "pricingRequest"
  | "offerNegotiation"
  | "pending_documents"
  | "offerSubmission"
  | "dps_agreement"
  | "invoicePayment"
  | "disqualified"
  | "opportunityLost"
  | "operator_denied"
  | "contract_finalized";