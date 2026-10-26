import { teamWebhookInboundEventRepository } from "@/app/api/infra/data/repositories/teamWebhook/TeamWebhookInboundEventRepository";
import { createInboundIntakeAdapters } from "./InboundIntakeAdapters";
import { ProcessInboundWebhookEventUseCase } from "./ProcessInboundWebhookEventUseCase";

let useCase: ProcessInboundWebhookEventUseCase | null = null;

function getUseCase(): ProcessInboundWebhookEventUseCase {
  useCase ??= new ProcessInboundWebhookEventUseCase({
    events: teamWebhookInboundEventRepository,
    ...createInboundIntakeAdapters(),
  });
  return useCase;
}

/** Processamento imediato (logo após o 202): só age se o evento ainda está `pending`. */
export async function processInboundWebhookEventById(eventId: string): Promise<void> {
  const claimed = await teamWebhookInboundEventRepository.claimById(eventId);
  if (!claimed) return;
  await getUseCase().execute(claimed);
}

/** Processa um lote já reivindicado (cron de retry). */
export async function processClaimedInboundWebhookEvents(
  rows: Parameters<ProcessInboundWebhookEventUseCase["execute"]>[0][],
): Promise<void> {
  const processor = getUseCase();
  for (const row of rows) {
    await processor.execute(row);
  }
}
