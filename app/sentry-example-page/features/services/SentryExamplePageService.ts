"use client"

import * as Sentry from "@sentry/nextjs"
import type { TriggerExampleErrorInput } from "../context/SentryExamplePageTypes"
import type { ISentryExamplePageService } from "./ISentryExamplePageService"

export class SentryExamplePageService implements ISentryExamplePageService {
  async triggerExampleError(input: TriggerExampleErrorInput) {
    const eventId = Sentry.captureException(new Error(input.message))
    await Sentry.flush(2000)

    return eventId
  }
}
