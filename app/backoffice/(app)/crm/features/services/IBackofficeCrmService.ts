import type {
  BackofficeLeadCreateInput,
  BackofficeLeadItem,
  BackofficeLeadStatusKey,
  BackofficeLeadUpdateInput,
} from "../context/BackofficeCrmTypes"

export interface IBackofficeCrmService {
  list(): Promise<BackofficeLeadItem[]>
  create(data: BackofficeLeadCreateInput): Promise<BackofficeLeadItem>
  update(id: string, data: BackofficeLeadUpdateInput): Promise<BackofficeLeadItem>
  updateStatus(id: string, status: BackofficeLeadStatusKey): Promise<BackofficeLeadItem>
  remove(id: string): Promise<void>
}
