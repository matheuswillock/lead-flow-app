import { createHash } from "node:crypto"
import JSZip from "jszip"
import { BackofficeDatabaseBackupExportRepository } from "@/app/api/infra/data/repositories/backoffice/DatabaseBackupRepository/BackofficeDatabaseBackupExportRepository"
import type { IBackofficeDatabaseBackupExportRepository } from "@/app/api/infra/data/repositories/backoffice/DatabaseBackupRepository/IBackofficeDatabaseBackupExportRepository"
import type {
  IBackofficeDatabaseBackupExportService,
  ExportZipResult,
} from "./IBackofficeDatabaseBackupExportService"

export class BackofficeDatabaseBackupExportService
  implements IBackofficeDatabaseBackupExportService
{
  constructor(
    private readonly exportRepository: IBackofficeDatabaseBackupExportRepository = new BackofficeDatabaseBackupExportRepository()
  ) {}

  async exportToZip(): Promise<ExportZipResult> {
    const snapshot = await this.exportRepository.exportSnapshot()

    const zip = new JSZip()
    for (const [modelName, json] of snapshot) {
      zip.file(`${modelName}.json`, json)
    }

    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, "0")
    const fileName = `backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}.zip`

    const buffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
    })

    const checksumSha256 = createHash("sha256").update(buffer).digest("hex")

    return {
      buffer,
      fileName,
      sizeBytes: buffer.length,
      checksumSha256,
    }
  }
}
