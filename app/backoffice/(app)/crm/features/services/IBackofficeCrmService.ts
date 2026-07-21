import type {
  BackofficeLeadCreateInput,
  BackofficeLeadItem,
  BackofficeLeadOfferCreateInput,
  BackofficeLeadOfferCreateResult,
  BackofficeLeadOfferListItem,
  BackofficeLeadScheduleInput,
  BackofficeLeadStatusKey,
  BackofficeLeadUpdateInput,
  BackofficeCrmUserOption,
  BackofficeOfferProductOption,
} from "../context/BackofficeCrmTypes"

export interface IBackofficeCrmService {
  list(): Promise<BackofficeLeadItem[]>
  listUsers(): Promise<BackofficeCrmUserOption[]>
  listActiveProducts(): Promise<BackofficeOfferProductOption[]>
  create(data: BackofficeLeadCreateInput): Promise<BackofficeLeadItem>
  update(id: string, data: BackofficeLeadUpdateInput): Promise<BackofficeLeadItem>
  updateStatus(
    id: string,
    status: BackofficeLeadStatusKey,
    schedule?: BackofficeLeadScheduleInput
  ): Promise<BackofficeLeadItem>
  remove(id: string): Promise<void>
  listOffers(leadId: string): Promise<BackofficeLeadOfferListItem[]>
  createOffer(
    leadId: string,
    data: BackofficeLeadOfferCreateInput
  ): Promise<BackofficeLeadOfferCreateResult>
  revokeOffer(leadId: string, offerId: string): Promise<BackofficeLeadOfferListItem>
}
