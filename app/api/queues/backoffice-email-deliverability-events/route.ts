import {
  handleBackofficeEmailDeliverabilityEventsCallback,
  BACKOFFICE_EMAIL_DELIVERABILITY_EVENTS_TOPIC,
} from "@/lib/queues/backoffice-email-deliverability-events"
import { backofficeEmailDeliverabilityRepository } from "@/app/api/infra/data/repositories/backofficeEmailDeliverability/BackofficeEmailDeliverabilityRepository"

export const POST = handleBackofficeEmailDeliverabilityEventsCallback(
  async (message: unknown) => {
    await backofficeEmailDeliverabilityRepository.project(message as Parameters<typeof backofficeEmailDeliverabilityRepository.project>[0])
  }
)
