import type {
  BackofficeAccountData,
  BackofficeAccountUpdateInput,
} from "../context/BackofficeAccountTypes"

export interface IBackofficeAccountService {
  getAccount(): Promise<BackofficeAccountData>
  updateAccount(input: BackofficeAccountUpdateInput): Promise<BackofficeAccountData>
  updatePassword(password: string): Promise<void>
  uploadIcon(file: File): Promise<{ iconId: string; publicUrl: string }>
  removeIcon(): Promise<void>
  updateTimezone(timezone: string): Promise<string>
  disconnectGoogle(): Promise<void>
}
