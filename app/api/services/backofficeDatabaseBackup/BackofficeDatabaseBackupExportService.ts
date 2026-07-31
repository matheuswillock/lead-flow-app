import { createHash } from "node:crypto"
import JSZip from "jszip"
import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  IBackofficeDatabaseBackupExportService,
  ExportZipResult,
} from "./IBackofficeDatabaseBackupExportService"

export class BackofficeDatabaseBackupExportService
  implements IBackofficeDatabaseBackupExportService
{
  async exportToZip(): Promise<ExportZipResult> {
    const zip = new JSZip()
    const models = Prisma.dmmf.datamodel.models

    for (const model of models) {
      const hasBytesField = model.fields.some((f) => f.type === "Bytes")
      if (hasBytesField) continue

      const delegateName =
        model.name.charAt(0).toLowerCase() + model.name.slice(1)

      try {
        const rows = await (prisma as unknown as Record<string, { findMany: () => Promise<unknown[]> }>)[delegateName].findMany()
        const json = JSON.stringify(rows, (_key, value) =>
          typeof value === "bigint" ? value.toString() : value
        )
        zip.file(`${model.name}.json`, json)
      } catch (err) {
        console.error(
          `[BackofficeDatabaseBackupExportService] Pulando modelo ${model.name}`,
          err
        )
      }
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
