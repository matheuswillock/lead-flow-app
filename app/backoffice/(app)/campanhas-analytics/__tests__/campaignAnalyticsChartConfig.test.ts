import { describe, expect, it } from "bun:test"
import { seriesChartConfig } from "../features/components/CampanhasAnalyticsSeriesAreaChart"
import { teamConversionChartConfig } from "../features/components/CampanhasAnalyticsTeamConversionBarChart"
import { openRateChartConfig } from "../features/components/CampanhasAnalyticsOpenRateBarChart"
import { formsFunnelChartConfig } from "../features/components/CampanhasAnalyticsFormsFunnelChart"
import type { ChartConfig } from "@/components/ui/chart"

const CHART_TOKEN_PATTERN = /^var\(--chart-[1-5]\)$/

// T-11.4 — nenhum ChartConfig deste feature pode usar hex ou cor Tailwind crua;
// só os tokens semânticos --chart-1..5 (DA2 da SPEC 11).
function assertOnlyChartTokens(config: ChartConfig, name: string) {
  for (const [key, entry] of Object.entries(config)) {
    expect(entry.color, `${name}.${key}.color`).toBeDefined()
    expect(entry.color).toMatch(CHART_TOKEN_PATTERN)
  }
}

describe("T-11.4 — ChartConfig usa exclusivamente tokens --chart-1..5", () => {
  it("SeriesAreaChart", () => assertOnlyChartTokens(seriesChartConfig, "seriesChartConfig"))
  it("TeamConversionBarChart", () => assertOnlyChartTokens(teamConversionChartConfig, "teamConversionChartConfig"))
  it("OpenRateBarChart", () => assertOnlyChartTokens(openRateChartConfig, "openRateChartConfig"))
  it("FormsFunnelChart", () => assertOnlyChartTokens(formsFunnelChartConfig, "formsFunnelChartConfig"))
})
