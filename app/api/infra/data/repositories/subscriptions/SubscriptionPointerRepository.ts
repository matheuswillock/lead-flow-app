import { prisma } from "@/app/api/infra/data/prisma";
import type {
  ISubscriptionPointerRepository,
  MigrateSubscriptionPointersInput,
} from "./ISubscriptionPointerRepository";

class PrismaSubscriptionPointerRepository implements ISubscriptionPointerRepository {
  async migrateSubscriptionPointers(input: MigrateSubscriptionPointersInput): Promise<void> {
    const {
      profileId,
      previousSubscriptionId,
      newSubscriptionId,
      account,
      subscriptionNextDueDate,
      operatorCount,
    } = input;

    // Transação interativa: ou os dois ponteiros avançam juntos, ou nenhum
    // avança. Ver o motivo em ISubscriptionPointerRepository (achado P1 da
    // revisão do PR #1207, thread PRRT_...YP_r).
    await prisma.$transaction(async (tx) => {
      await tx.profile.update({
        where: { id: profileId },
        data: {
          asaasSubscriptionId: newSubscriptionId,
          asaasSubscriptionAccount: account,
          subscriptionNextDueDate,
          operatorCount,
        },
      });

      await tx.profileSubscription.updateMany({
        where: { profileId, asaasSubscriptionId: previousSubscriptionId },
        data: {
          asaasSubscriptionId: newSubscriptionId,
          asaasSubscriptionAccount: account,
        },
      });
    });
  }
}

export const subscriptionPointerRepository: ISubscriptionPointerRepository =
  new PrismaSubscriptionPointerRepository();
