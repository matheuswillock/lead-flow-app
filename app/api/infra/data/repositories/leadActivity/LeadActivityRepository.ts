import type { LeadActivity } from "@prisma/client";
import { prisma } from "../../prisma";
import type {
  CreateLeadActivityDTO,
  ILeadActivityRepository,
} from "./ILeadActivityRepository";

export class LeadActivityRepository implements ILeadActivityRepository {
  async create(data: CreateLeadActivityDTO): Promise<LeadActivity> {
    return await prisma.leadActivity.create({
      data: {
        leadId: data.leadId,
        type: data.type,
        body: data.body,
        ...(data.payload !== undefined && { payload: data.payload ?? undefined }),
        createdBy: data.createdBy ?? null,
      },
    });
  }
}

export const leadActivityRepository = new LeadActivityRepository();
