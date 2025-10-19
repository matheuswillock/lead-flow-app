import { DeleteProfileIconResult } from "./DTOs/DeleteProfileIconResult";
import { ProfileIconUploadResult } from "./DTOs/ProfileIconUploadResult";


export interface IProfileIconService {
  uploadProfileIcon(file: File, userId: string): Promise<ProfileIconUploadResult>
  deleteProfileIcon(iconId: string): Promise<DeleteProfileIconResult>
  getProfileIconUrl(iconId: string): Promise<string | null>
  listUserIcons(userId: string): Promise<string[]>
}