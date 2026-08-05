import type { RadarExportFormat, RadarExportRow } from "@/lib/radar/exportRadarProfiles"
import { buildRadarExportFile } from "@/lib/radar/exportRadarProfiles"

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute("download", fileName)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function downloadRadarExportFile(
  rows: RadarExportRow[],
  format: RadarExportFormat,
  fileNameBase: string
): Promise<void> {
  const file = buildRadarExportFile(rows, format, fileNameBase)
  const blob =
    typeof file.content === "string"
      ? new Blob([file.content], { type: file.contentType })
      : new Blob([file.content], { type: file.contentType })
  downloadBlob(blob, file.fileName)
}
