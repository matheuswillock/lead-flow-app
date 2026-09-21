import * as XLSX from "xlsx"
import type {
  CampaignAnalyticsExportAllWorkbookInput,
  CampaignAnalyticsExportAllWorkbookResult,
  IBackofficeCampaignAnalyticsExportAllService,
} from "./IBackofficeCampaignAnalyticsExportAllService"

/** Prefixa célula que Excel/LibreOffice interpretariam como fórmula (mesma defesa de lib/radar/exportRadarProfiles.ts). */
function escapeFormulaCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

export class BackofficeCampaignAnalyticsExportAllService implements IBackofficeCampaignAnalyticsExportAllService {
  buildWorkbook(input: CampaignAnalyticsExportAllWorkbookInput): CampaignAnalyticsExportAllWorkbookResult {
    const workbook = XLSX.utils.book_new()

    for (const sheet of input.sheets) {
      const escapedRows = sheet.rows.map((row) => row.map(escapeFormulaCell))
      const worksheet = XLSX.utils.aoa_to_sheet([sheet.headers, ...escapedRows])
      XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name)
    }

    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer
    return { buffer, filename: input.filename }
  }
}

export const backofficeCampaignAnalyticsExportAllService = new BackofficeCampaignAnalyticsExportAllService()
