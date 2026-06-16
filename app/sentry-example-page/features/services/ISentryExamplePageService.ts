import type { TriggerExampleErrorInput } from "../context/SentryExamplePageTypes"

export interface ISentryExamplePageService {
  triggerExampleError(input: TriggerExampleErrorInput): Promise<string>
}
