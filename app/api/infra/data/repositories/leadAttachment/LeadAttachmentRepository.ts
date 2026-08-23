import { prisma } from "../../prisma";
import type {
  ILeadAttachmentRepository,
  LeadAttachmentDownloadRef,
} from "./ILeadAttachmentRepository";

export class LeadAttachmentRepository implements ILeadAttachmentRepository {
  async findDownloadRefsByLeadId(leadId: string): Promise<LeadAttachmentDownloadRef[]> {
    return await prisma.leadAttachment.findMany({
      where: { leadId },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        storagePath: true,
        fileUrl: true,
      },
      orderBy: { uploadedAt: "asc" },
    });
  }
}

export const leadAttachmentRepository = new LeadAttachmentRepository();
