import { Prisma } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import type { GoogleConnectionEventInput, IGoogleConnectionEventRepository } from "./IGoogleConnectionEventRepository";

export class GoogleConnectionEventRepository implements IGoogleConnectionEventRepository {
  async create(input: GoogleConnectionEventInput): Promise<void> {
    if (input.dedupeKey) {
      const existing = await prisma.googleConnectionEvent.findUnique({ where: { dedupeKey: input.dedupeKey }, select: { id: true } });
      if (existing) return;
    }
    try {
      await prisma.googleConnectionEvent.create({ data: input });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && input.dedupeKey) return;
      throw error;
    }
  }
}

export const googleConnectionEventRepository = new GoogleConnectionEventRepository();
