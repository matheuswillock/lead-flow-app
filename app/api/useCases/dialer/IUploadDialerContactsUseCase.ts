import type { Output } from "@/lib/output";
import type { DialerTeamContext } from "@/app/api/infra/data/repositories/dialer/IDialerRepository";

export type UploadDialerContactsInput = {
  fileName: string;
  fileType: "xlsx" | "json";
  buffer: Buffer;
};

export interface IUploadDialerContactsUseCase {
  uploadContacts(
    ctx: DialerTeamContext,
    campaignId: string,
    input: UploadDialerContactsInput
  ): Promise<Output>;
}
