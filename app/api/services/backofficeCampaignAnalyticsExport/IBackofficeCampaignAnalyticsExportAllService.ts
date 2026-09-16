// Serviço genérico de montagem de planilha — não conhece o domínio de
// campanhas, só recebe tabelas já rotuladas/formatadas (headers + linhas de
// string) e devolve um workbook. O UseCase é quem decide o que vira cada aba.

export type CampaignAnalyticsExportAllSheet = {
  name: string
  headers: string[]
  rows: string[][]
}

export type CampaignAnalyticsExportAllWorkbookInput = {
  filename: string
  sheets: CampaignAnalyticsExportAllSheet[]
}

export type CampaignAnalyticsExportAllWorkbookResult = {
  buffer: ArrayBuffer
  filename: string
}

export interface IBackofficeCampaignAnalyticsExportAllService {
  buildWorkbook(input: CampaignAnalyticsExportAllWorkbookInput): CampaignAnalyticsExportAllWorkbookResult
}
