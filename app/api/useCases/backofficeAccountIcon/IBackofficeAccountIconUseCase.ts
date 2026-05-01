import type { Output } from "@/lib/output"

export interface IBackofficeAccountIconUseCase {
  uploadIcon(params: { profileId: string; supabaseId: string; file: File }): Promise<Output>
  removeIcon(params: { profileId: string; supabaseId: string }): Promise<Output>
}

