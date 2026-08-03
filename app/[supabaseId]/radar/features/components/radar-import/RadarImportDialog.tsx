"use client"

import { useState } from "react"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog"
import { ImportDialogHeader } from "@/components/import/ImportDialogHeader"
import { ImportRequiredFooterHint } from "@/components/import/ImportRequiredFooterHint"
import { LeadFileDropzone } from "@/app/[supabaseId]/components/lead-import/LeadFileDropzone"
import { parseLeadFile } from "@/app/[supabaseId]/components/lead-import/leadFileParser"
import { autoMapRadarColumns, type RadarImportMapping } from "@/lib/radarImport/autoMapRadarColumns"
import { RADAR_IMPORT_MAX_ROWS, slugifyRadarFieldKey } from "@/lib/radarImport/radarImportFields"
import { radarImportService } from "../../services/RadarImportService"
import { RadarFieldMapper } from "./RadarFieldMapper"
import { RadarImportSummary } from "./RadarImportSummary"

type RadarImportStep = "upload" | "mapping" | "summary"

const STEP_TITLES: Record<RadarImportStep, string> = {
  upload: "Enviar arquivo",
  mapping: "Mapear campos",
  summary: "Confirmar importação",
}

const STEP_DESCRIPTIONS: Record<RadarImportStep, string> = {
  upload: "Envie uma planilha Excel (.xlsx), CSV (.csv) ou JSON com a base externa.",
  mapping:
    "Relacione as colunas do arquivo com os campos do Radar. Campos extras podem virar definições dinâmicas.",
  summary: "Revise o mapeamento e informe o nome da base antes de iniciar a importação em segundo plano.",
}

type RadarImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  supabaseId?: string
  teamId?: string | null
  onImportQueued?: (importId: string) => void
}

export function RadarImportDialog({
  open,
  onOpenChange,
  supabaseId,
  teamId,
  onImportQueued,
}: RadarImportDialogProps) {
  const [step, setStep] = useState<RadarImportStep>("upload")
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState("")
  const [columns, setColumns] = useState<string[]>([])
  const [rows, setRows] = useState<Array<{ line: number; values: Record<string, string> }>>([])
  const [mapping, setMapping] = useState<RadarImportMapping>({})
  const [baseName, setBaseName] = useState("")
  const [isParsing, setIsParsing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const resetState = () => {
    setStep("upload")
    setFile(null)
    setFileName("")
    setColumns([])
    setRows([])
    setMapping({})
    setBaseName("")
    setIsParsing(false)
    setIsSubmitting(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (isSubmitting) return
    onOpenChange(nextOpen)
    if (!nextOpen) resetState()
  }

  const handleFileSelected = async (selectedFile: File) => {
    setIsParsing(true)
    try {
      const parsed = await parseLeadFile(selectedFile)
      if (parsed.rows.length === 0) {
        toast.error("Nenhuma linha com dados foi encontrada no arquivo")
        return
      }
      if (parsed.rows.length > RADAR_IMPORT_MAX_ROWS) {
        toast.error(
          `O arquivo tem ${parsed.rows.length} linhas. O limite é de ${RADAR_IMPORT_MAX_ROWS} por importação.`
        )
        return
      }

      setFile(selectedFile)
      setFileName(selectedFile.name)
      setColumns(parsed.columns)
      setRows(parsed.rows)
      setMapping(autoMapRadarColumns(parsed.columns))
      setBaseName(selectedFile.name.replace(/\.[^.]+$/, ""))
      setStep("mapping")
    } catch (error) {
      console.error("[RadarImportDialog][handleFileSelected]", error)
      toast.error(error instanceof Error ? error.message : "Não foi possível ler o arquivo")
    } finally {
      setIsParsing(false)
    }
  }

  const handleMappingChange = (fieldKey: string, column: string | undefined) => {
    setMapping((prev) => {
      const next = { ...prev }
      if (column) next[fieldKey] = column
      else delete next[fieldKey]
      return next
    })
  }

  const handleCreateFieldForColumn = (column: string) => {
    const key = `new:${slugifyRadarFieldKey(column)}`
    setMapping((prev) => ({ ...prev, [key]: column }))
  }

  const hasIdentityMapping = Boolean(mapping.name || mapping.phone || mapping.email)
  const identityPendingCount = hasIdentityMapping ? 0 : 1
  const stepIndex = step === "upload" ? 1 : step === "mapping" ? 2 : 3
  const mappingRecord = Object.fromEntries(
    Object.entries(mapping).filter((entry): entry is [string, string] => Boolean(entry[1]))
  )

  const handleSubmit = async () => {
    if (!supabaseId || !teamId || !file) return
    if (!baseName.trim()) {
      toast.error("Informe o nome da base")
      return
    }
    if (!hasIdentityMapping) {
      toast.error("Mapeie pelo menos nome, telefone ou e-mail")
      return
    }

    setIsSubmitting(true)
    try {
      const uploadResult = await radarImportService.uploadFile(supabaseId, teamId, file)
      const enqueueResult = await radarImportService.enqueueMappedImport(supabaseId, teamId, {
        importId: uploadResult.importId,
        storagePath: uploadResult.storagePath,
        baseName: baseName.trim(),
        fieldMapping: mappingRecord,
        sourceFormat: uploadResult.sourceFormat,
        totalRows: uploadResult.totalRows,
      })

      toast.success("Importação enfileirada. Você será notificado ao concluir.")
      onImportQueued?.(enqueueResult.importId)
      handleOpenChange(false)
    } catch (error) {
      console.error("[RadarImportDialog][handleSubmit]", error)
      toast.error(error instanceof Error ? error.message : "Não foi possível iniciar a importação")
    } finally {
      setIsSubmitting(false)
    }
  }

  const flatRows = rows.map((row) => row.values)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
        <ImportDialogHeader
          title="Importar base no Radar"
          stepIndex={stepIndex}
          totalSteps={3}
          stepTitle={STEP_TITLES[step]}
          stepDescription={STEP_DESCRIPTIONS[step]}
        />

        <div className="flex-1 overflow-y-auto px-1">
          {step === "upload" ? (
            <LeadFileDropzone
              onFileSelected={handleFileSelected}
              onError={(message) => toast.error(message)}
              disabled={isParsing}
            />
          ) : null}

          {step === "mapping" ? (
            <RadarFieldMapper
              columns={columns}
              rows={flatRows}
              mapping={mappingRecord}
              onMappingChange={handleMappingChange}
              onCreateFieldForColumn={handleCreateFieldForColumn}
              disabled={isSubmitting}
            />
          ) : null}

          {step === "summary" ? (
            <RadarImportSummary
              fileName={fileName}
              rowCount={rows.length}
              mapping={mappingRecord}
              baseName={baseName}
              onBaseNameChange={setBaseName}
            />
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          {step === "mapping" ? <ImportRequiredFooterHint pendingCount={identityPendingCount} /> : <span />}
          <div className="flex gap-2">
            {step !== "upload" ? (
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => setStep(step === "summary" ? "mapping" : "upload")}
              >
                <ArrowLeft data-icon="inline-start" />
                Voltar
              </Button>
            ) : null}

            {step === "mapping" ? (
              <Button type="button" disabled={!hasIdentityMapping || isSubmitting} onClick={() => setStep("summary")}>
                Continuar
              </Button>
            ) : null}

            {step === "summary" ? (
              <Button type="button" disabled={isSubmitting || !baseName.trim()} onClick={() => void handleSubmit()}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : null}
                Iniciar importação
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
