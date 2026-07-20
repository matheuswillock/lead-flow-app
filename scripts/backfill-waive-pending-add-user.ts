import { prisma } from "@/app/api/infra/data/prisma";
import { memberProBillingUseCase } from "@/app/api/useCases/billing/MemberProBillingUseCase";
import { pendingActionUseCase } from "@/app/api/useCases/pendingActions/PendingActionUseCase";

const shouldApply = process.argv.includes("--confirm");
const REASON = "unlimited_users_backfill";

type Payload = Record<string, unknown>;

function readCharge(payload: Payload): number {
  const totalCharge = Number(payload.totalCharge ?? 0);
  if (Number.isFinite(totalCharge) && totalCharge > 0) return totalCharge;
  const billingDelta = Number(payload.billingDelta ?? 0);
  return Number.isFinite(billingDelta) ? billingDelta : 0;
}

async function main() {
  if (!shouldApply) {
    console.info("Dry run. Reexecute com --confirm para aplicar sem cobrança.");
  }

  const pendingActions = await prisma.pendingAction.findMany({
    where: {
      actionType: "add_user",
      status: "pending",
    },
    select: {
      id: true,
      masterId: true,
      payload: true,
      createdAt: true,
      master: {
        select: {
          email: true,
          fullName: true,
          hasUnlimitedUsers: true,
          hasPermanentSubscription: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  let eligible = 0;
  let applied = 0;
  let skipped = 0;
  let failed = 0;

  for (const action of pendingActions) {
    const bypass = await memberProBillingUseCase.shouldBypassIncrementalCharge(action.masterId);
    if (!bypass) {
      skipped += 1;
      continue;
    }

    eligible += 1;
    const payload = (action.payload as Payload) || {};
    const email = typeof payload.email === "string" ? payload.email : "";
    const name = typeof payload.name === "string" ? payload.name : "";
    const totalCharge = readCharge(payload);

    console.info(
      [
        `[eligible] action=${action.id}`,
        `master=${action.master.email}`,
        `user=${name}<${email}>`,
        `charge=${totalCharge}`,
        `createdAt=${action.createdAt.toISOString()}`,
      ].join(" ")
    );

    if (!shouldApply) {
      continue;
    }

    const result = await pendingActionUseCase.forceApplyPendingActionWithoutCharge(action.id, {
      reason: REASON,
    });

    if (result.isValid) {
      applied += 1;
      console.info(`[applied] action=${action.id}`);
    } else {
      failed += 1;
      console.error(`[failed] action=${action.id}`, result.errorMessages);
    }
  }

  console.info(
    JSON.stringify(
      {
        mode: shouldApply ? "confirm" : "dry-run",
        scanned: pendingActions.length,
        eligible,
        skipped,
        applied,
        failed,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("[backfill-waive-pending-add-user]", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
