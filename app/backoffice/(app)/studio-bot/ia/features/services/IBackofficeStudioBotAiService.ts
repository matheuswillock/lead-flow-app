import type {
  ApiOutput,
  BethaniaAiConfiguration,
  BethaniaAiOverview,
} from "../context/BackofficeStudioBotAiTypes"

export interface IBackofficeStudioBotAiService {
  getOverview(): Promise<BethaniaAiOverview>
  getConfiguration(): Promise<BethaniaAiConfiguration>
  patchConfiguration(body: Partial<BethaniaAiConfiguration>): Promise<ApiOutput<BethaniaAiConfiguration>>
  testProvider(): Promise<ApiOutput<unknown>>
}
