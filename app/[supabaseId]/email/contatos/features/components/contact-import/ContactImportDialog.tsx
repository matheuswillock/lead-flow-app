"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toUserToastMessage, toastUserError } from "@/lib/ui/to-user-toast-message";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { ImportDialogHeader } from "@/components/import/ImportDialogHeader";
import { ImportProgressSummary } from "@/components/import/ImportProgressSummary";
import { ImportRequiredFooterHint } from "@/components/import/ImportRequiredFooterHint";
import { buildContactImportPreview } from "@/lib/emailContactImport/buildContactImportPreview";
import {
  EMAIL_CONTACT_IMPORT_FIELDS,
  EMAIL_CONTACT_IMPORT_MAX_ROWS,
  type EmailContactImportFieldKey,
} from "@/lib/emailContactImport/emailContactImportFields";
import { LeadFileDropzone } from "@/app/[supabaseId]/components/lead-import/LeadFileDropzone";
import {
  parseLeadFile,
  type ParsedLeadRow,
} from "@/app/[supabaseId]/components/lead-import/leadFileParser";
import { ContactFieldMapper } from "./ContactFieldMapper";
import { ContactImportSummary } from "./ContactImportSummary";
import { ContactImportPreviewCard } from "./ContactImportPreviewCard";
import { buildMappedContactRows } from "./buildMappedContactRows";
import {
  autoMapEmailContactColumns,
  type EmailContactImportMapping,
} from "./autoMapEmailContactColumns";
import { ContatosService } from "../../services/ContatosService";
import { ContactListSegmentPicker } from "./ContactListSegmentPicker";
import { useOptionalFeatureAccess } from "@/app/context/FeatureAccessContext";
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs";
import { useStudioEmailRuntime } from "@/lib/email/use-studio-email-runtime";

type ContactImportStep = "upload" | "mapping" | "summary";

const STEP_TITLES: Record<ContactImportStep, string> = {
  upload: "Enviar arquivo",
  mapping: "Mapear campos",
  summary: "Confirmar importação",
};

const STEP_DESCRIPTIONS: Record<ContactImportStep, string> = {
  upload: "Envie uma planilha Excel (.xlsx), CSV (.csv) ou um arquivo JSON com os seus contatos.",
  mapping:
    "Relacione as colunas do seu arquivo com os campos do Corretor Studio. Cada campo explica para que serve.",
  summary: "Revise o mapeamento antes de concluir a importação.",
};

const service = new ContatosService();

interface ContactImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listId: string;
  supabaseId: string;
  onImportComplete?: () => Promise<void> | void;
}

export function ContactImportDialog({
  open,
  onOpenChange,
  listId,
  supabaseId,
  onImportComplete,
}: ContactImportDialogProps) {
  const [step, setStep] = useState<ContactImportStep>("upload");
  const [fileName, setFileName] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedLeadRow[]>([]);
  const [mapping, setMapping] = useState<EmailContactImportMapping>({});
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [segmentId, setSegmentId] = useState<string | null>(null);
  const [segmentName, setSegmentName] = useState<string | null>(null);
  const { hideRadarSegments } = useStudioEmailRuntime();
  const featureAccess = useOptionalFeatureAccess();
  const hasRadar = hideRadarSegments
    ? false
    : Boolean(featureAccess?.hasAccess(FEATURE_SLUGS.RADAR));

  const resetState = () => {
    setStep("upload");
    setFileName("");
    setColumns([]);
    setRows([]);
    setMapping({});
    setIsParsing(false);
    setIsSubmitting(false);
    setSegmentId(null);
    setSegmentName(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (isSubmitting) return;
    onOpenChange(nextOpen);
    if (!nextOpen) {
      resetState();
    }
  };

  const handleFileSelected = async (file: File) => {
    setIsParsing(true);
    try {
      const parsed = await parseLeadFile(file);
      if (parsed.rows.length === 0) {
        toast.error("Nenhuma linha com dados foi encontrada no arquivo");
        return;
      }
      if (parsed.rows.length > EMAIL_CONTACT_IMPORT_MAX_ROWS) {
        toast.error(
          `O arquivo tem ${parsed.rows.length} linhas. O limite é de ${EMAIL_CONTACT_IMPORT_MAX_ROWS} por importação — divida o arquivo e tente novamente.`
        );
        return;
      }
      setFileName(file.name);
      setColumns(parsed.columns);
      setRows(parsed.rows);
      setMapping(autoMapEmailContactColumns(parsed.columns));
      setStep("mapping");
    } catch (error) {
      console.error("[ContactImportDialog] handleFileSelected error", error);
      toastUserError(error);
    } finally {
      setIsParsing(false);
    }
  };

  const handleMappingChange = (field: EmailContactImportFieldKey, column: string | undefined) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (column) {
        next[field] = column;
      } else {
        delete next[field];
      }
      return next;
    });
  };

  const importPreview = useMemo(
    () => buildContactImportPreview(buildMappedContactRows(rows, columns, mapping)),
    [rows, columns, mapping]
  );

  const handleImport = async () => {
    if (isSubmitting) return;
    if (!mapping.email) {
      toast.error("Mapeie a coluna de e-mail antes de importar");
      return;
    }

    if (importPreview.importableCount === 0) {
      toast.error("Nenhuma linha do arquivo tem um e-mail válido na coluna mapeada");
      return;
    }

    setIsSubmitting(true);
    try {
      if (segmentId) {
        await service.setListRadarSegment(listId, segmentId);
      }
      await service.importMapped(listId, importPreview.importableRows);
      const skippedNote =
        importPreview.skippedCount > 0
          ? ` ${
              importPreview.skippedCount === 1
                ? "1 e-mail não será incluído porque não é um e-mail válido."
                : `${importPreview.skippedCount} e-mails não serão incluídos porque não são e-mails válidos.`
            }`
          : "";
      toast.success(`Processando importação em segundo plano.${skippedNote}`);
      if (onImportComplete) {
        await onImportComplete();
      }
      handleOpenChange(false);
    } catch (error) {
      console.error("[ContactImportDialog] handleImport error", error);
      toastUserError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const requiredFieldKeys: EmailContactImportFieldKey[] = ["email"];
  const requiredPendingCount = requiredFieldKeys.filter((key) => !mapping[key]).length;
  const requiredFieldsMapped = requiredPendingCount === 0;
  const mappedFieldCount = Object.keys(mapping).length;
  const stepIndex = step === "upload" ? 1 : step === "mapping" ? 2 : 3;
  const showImportPreview = Boolean(mapping.email) && importPreview.totalFileRows > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-2xl">
        <ImportDialogHeader
          title="Importar contatos"
          stepIndex={stepIndex}
          totalSteps={3}
          stepTitle={STEP_TITLES[step]}
          stepDescription={STEP_DESCRIPTIONS[step]}
        />

        {step === "mapping" && (
          <div className="flex flex-col gap-3">
            <ImportProgressSummary
              mapped={mappedFieldCount}
              total={EMAIL_CONTACT_IMPORT_FIELDS.length}
              label="campos mapeados"
            />
            {showImportPreview ? (
              <ContactImportPreviewCard preview={importPreview} variant="detailed" />
            ) : null}
          </div>
        )}

        <div className="overflow-y-auto flex-1 pr-1">
          {step === "upload" && (
            <LeadFileDropzone
              onFileSelected={handleFileSelected}
              onError={(message) => toast.error(toUserToastMessage(message))}
              disabled={isParsing}
            />
          )}
          {step === "mapping" && (
            <ContactFieldMapper
              columns={columns}
              rows={rows.map((row) => row.values)}
              mapping={mapping}
              onMappingChange={handleMappingChange}
            />
          )}
          {step === "summary" && (
            <div className="flex flex-col gap-4">
              <ContactImportSummary
                fileName={fileName}
                preview={importPreview}
                mapping={mapping}
              />
              {hasRadar && (
                <div className="flex flex-col gap-2 rounded-md border p-4">
                  <p className="text-sm font-medium">Segmento do Radar (opcional)</p>
                  <p className="text-xs text-muted-foreground">
                    Vincule os contatos importados a um segmento para usá-los em campanhas e filtros.
                  </p>
                  <ContactListSegmentPicker
                    listId={listId}
                    supabaseId={supabaseId}
                    selectedSegmentId={segmentId}
                    selectedSegmentName={segmentName}
                    onSelect={(id, name) => { setSegmentId(id); setSegmentName(name); }}
                    onClear={() => { setSegmentId(null); setSegmentName(null); }}
                    disabled={isSubmitting}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step === "upload" && (
            <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={isParsing}>
              Cancelar
            </Button>
          )}
          {step === "mapping" && (
            <>
              <Button variant="ghost" onClick={resetState} className="sm:mr-auto">
                <ArrowLeft className="mr-2 size-4" />
                Trocar arquivo
              </Button>
              <div className="flex items-center gap-3">
                <ImportRequiredFooterHint pendingCount={requiredPendingCount} />
                <Button
                  onClick={() => setStep("summary")}
                  disabled={!requiredFieldsMapped || importPreview.importableCount === 0}
                >
                  Continuar
                </Button>
              </div>
            </>
          )}
          {step === "summary" && (
            <>
              <Button variant="ghost" onClick={() => setStep("mapping")} disabled={isSubmitting}>
                <ArrowLeft className="mr-2 size-4" />
                Voltar
              </Button>
              <Button onClick={handleImport} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Iniciar importação"
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
