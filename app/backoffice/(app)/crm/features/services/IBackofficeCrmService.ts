import type {
  BackofficeLeadCreateInput,
  BackofficeLeadItem,
  BackofficeLeadScheduleInput,
  BackofficeLeadStatusKey,
  BackofficeLeadUpdateInput,
  BackofficeCrmUserOption,
} from "../context/BackofficeCrmTypes"

export interface IBackofficeCrmService {
  list(): Promise<BackofficeLeadItem[]>
  listUsers(): Promise<BackofficeCrmUserOption[]>
  create(data: BackofficeLeadCreateInput): Promise<BackofficeLeadItem>
  update(id: string, data: BackofficeLeadUpdateInput): Promise<BackofficeLeadItem>
  updateStatus(
    id: string,
    status: BackofficeLeadStatusKey,
    schedule?: BackofficeLeadScheduleInput
  ): Promise<BackofficeLeadItem>
  remove(id: string): Promise<void>
}
