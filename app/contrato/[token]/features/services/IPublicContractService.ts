import type {
  PublicContractDownload,
  PublicContractShare,
} from "../context/PublicContractTypes"

export interface IPublicContractService {
  getShare(token: string): Promise<PublicContractShare>
  getDownloadUrl(token: string): Promise<PublicContractDownload>
}
