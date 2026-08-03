export type RadarImportUploadResult = {
  importId: string
  storagePath: string
  columns: string[]
  previewRows: Array<{ line: number; values: Record<string, string> }>
  totalRows: number
  sourceFormat: string
}

export type RadarImportEnqueueResult = {
  importId: string
}

export type RadarImportJobStatus = {
  importId: string
  status: string
  baseName: string
  totalRows: number
  processedRows: number
  createdCount: number
  enrichedCount: number
  skippedCount: number
  deferredCount: number
}

export type RadarFieldDefinition = {
  id: string
  key: string
  label: string
  valueType: string
}

export interface IRadarImportService {
  uploadFile(supabaseId: string, teamId: string, file: File): Promise<RadarImportUploadResult>
  enqueueMappedImport(
    supabaseId: string,
    teamId: string,
    payload: {
      importId: string
      storagePath: string
      baseName: string
      fieldMapping: Record<string, string>
      sourceFormat: string
      totalRows: number
    }
  ): Promise<RadarImportEnqueueResult>
  getJobStatus(supabaseId: string, teamId: string, importId: string): Promise<RadarImportJobStatus>
  listFieldDefinitions(supabaseId: string, teamId: string): Promise<RadarFieldDefinition[]>
}
