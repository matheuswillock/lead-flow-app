import type { PerformanceData } from "../context/PerformanceTypes";
import {
  buildCsvFiles,
  buildExcelFile,
  buildZipBufferFromFiles,
  type PerformanceExportFormat,
  type PerformanceExportSectionFlags,
} from "@/lib/performance/exportPerformanceFiles";

export type ExportSectionFlags = PerformanceExportSectionFlags;

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportPerformanceFileDownload(
  data: PerformanceData,
  sections: ExportSectionFlags,
  fileNameBase: string,
  format: PerformanceExportFormat
): Promise<void> {
  if (format === "excel") {
    const excelFile = buildExcelFile(data, sections);
    const excelBlob = new Blob([excelFile.content], { type: excelFile.contentType });
    downloadBlob(excelBlob, `${fileNameBase}.xlsx`);
    return;
  }

  const csvFiles = buildCsvFiles(data, sections);
  const zipBuffer = await buildZipBufferFromFiles(csvFiles);
  const zipBlob = new Blob([zipBuffer], { type: "application/zip" });
  downloadBlob(zipBlob, `${fileNameBase}.zip`);
}
