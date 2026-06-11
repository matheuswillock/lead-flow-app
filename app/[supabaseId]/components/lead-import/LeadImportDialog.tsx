"use client";

import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  LEAD_IMPORT_MAX_ROWS,
  type LeadImportFieldKey,
  type LeadImportRow,
} from "@/lib/leadImport/leadImportFields";
import { suggestLeadStatus, type LeadImportStatusKey } from "@/lib/leadImport/leadImportStatus";
import { LeadFileDropzone } from "./LeadFileDropzone";
import { LeadFieldMapper } from "./LeadFieldMapper";
import {
  LeadStatusMapper,
  type LeadStatusMapping,
  type LeadStatusValueCount,
} from "./LeadStatusMapper";
import { LeadImportSummary } from "./LeadImportSummary";
import { autoMapColumns, type LeadImportMapping } from "./autoMapColumns";
import { parseLeadFile } from "./leadFileParser";
import { leadImportService } from "./LeadImportService";
import type { LeadImportResult } from "./ILeadImportService";

type LeadImportStep = "upload" | "mapping" | "statuses" | "summary";

const STEP_TITLES: Record<LeadImportStep, string> = {
  upload: "Enviar arquivo",
  mapping: "Mapear campos",
  statuses: "Mapear status",
  summary: "Confirmar importação",
};

const STEP_DESCRIPTIONS: Record<LeadImportStep, string> = {
  upload: "Envie uma planilha Excel (.xlsx) ou um arquivo JSON com os seus leads.",
  mapping:
    "Relacione as colunas do seu arquivo com os campos do Corretor Studio. Cada campo explica para que serve.",
  statuses:
    "Relacione os status encontrados no seu arquivo com os status do funil do Corretor Studio.",
  summary: "Revise o mapeamento antes de concluir a importação.",
};

interface LeadImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supabaseId?: string;
  teamId?: string | null;
  onImportComplete?: () => Promise<void> | void;
}

export function LeadImportDialog({
  open,
  onOpenChange,
  supabaseId,
  teamId,
  onImportComplete,
}: LeadImportDialogProps) {
  const [step, setStep] = useState<LeadImportStep>("upload");
  const [fileName, setFileName] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<LeadImportMapping>({});
  const [statusMapping, setStatusMapping] = useState<LeadStatusMapping>({});
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<LeadImportResult | null>(null);

  const resetState = () => {
    setStep("upload");
    setFileName("");
    setColumns([]);
    setRows([]);
    setMapping({});
    setStatusMapping({});
    setIsParsing(false);
    setIsSubmitting(false);
    setResult(null);
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
      if (parsed.rows.length > LEAD_IMPORT_MAX_ROWS) {
        toast.error(
          `O arquivo tem ${parsed.rows.length} linhas. O limite é de ${LEAD_IMPORT_MAX_ROWS} por importação — divida o arquivo e tente novamente.`
        );
        return;
      }
      setFileName(file.name);
      setColumns(parsed.columns);
      setRows(parsed.rows);
      setMapping(autoMapColumns(parsed.columns));
      setStep("mapping");
    } catch (error) {
      console.error("Erro ao ler arquivo de leads:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível ler o arquivo");
    } finally {
      setIsParsing(false);
    }
  };

  const handleMappingChange = (field: LeadImportFieldKey, column: string | undefined) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (column) {
        next[field] = column;
      } else {
        delete next[field];
      }
      return next;
    });
    if (field === "status") {
      setStatusMapping({});
    }
  };

  const getDistinctStatusValues = (): LeadStatusValueCount[] => {
    const statusColumn = mapping.status;
    if (!statusColumn) return [];
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      const value = row[statusColumn]?.trim();
      if (!value) return;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });
    return Array.from(counts.entries()).map(([value, count]) => ({ value, count }));
  };

  const distinctStatusValues = getDistinctStatusValues();
  const hasStatusStep = distinctStatusValues.length > 0;

  const goToStatusStep = () => {
    setStatusMapping((prev) => {
      const next: LeadStatusMapping = {};
      distinctStatusValues.forEach(({ value }) => {
        next[value] = prev[value] ?? suggestLeadStatus(value);
      });
      return next;
    });
    setStep("statuses");
  };

  const handleStatusMappingChange = (fileValue: string, status: LeadImportStatusKey) => {
    setStatusMapping((prev) => ({ ...prev, [fileValue]: status }));
  };

  const buildMappedRows = (): LeadImportRow[] => {
    const entries = Object.entries(mapping) as [LeadImportFieldKey, string][];
    return rows
      .map((row) => {
        const mapped: LeadImportRow = {};
        entries.forEach(([field, column]) => {
          const value = row[column]?.trim();
          if (value) {
            mapped[field] = value;
          }
        });
        if (mapped.status && statusMapping[mapped.status]) {
          mapped.status = statusMapping[mapped.status];
        }
        return mapped;
      })
      .filter((mapped) => Boolean(mapped.name) && Boolean(mapped.phone));
  };

  const handleImport = async () => {
    if (isSubmitting) return;
    if (!supabaseId) {
      toast.error("Usuário não identificado");
      return;
    }
    if (!teamId) {
      toast.error("Selecione um time para importar leads");
      return;
    }

    const mappedRows = buildMappedRows();
    if (mappedRows.length === 0) {
      toast.error(
        "Nenhuma linha do arquivo tem valor nas colunas mapeadas para nome e telefone do lead"
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const importResult = await leadImportService.importMappedLeads(mappedRows, {
        supabaseId,
        teamId,
      });
      setResult(importResult);
      toast.success(`Importação concluída. Criados: ${importResult.created}.`);
      if (onImportComplete) {
        await onImportComplete();
      }
    } catch (error) {
      console.error("Erro ao importar leads:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao importar leads");
    } finally {
      setIsSubmitting(false);
    }
  };

  const areRequiredFieldsMapped = Boolean(mapping.name) && Boolean(mapping.phone);
  const totalSteps = hasStatusStep ? 4 : 3;
  const stepIndex =
    step === "upload" ? 1 : step === "mapping" ? 2 : step === "statuses" ? 3 : totalSteps;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Importar leads
            <Badge variant="secondary">
              Etapa {stepIndex} de {totalSteps}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {STEP_TITLES[step]} — {STEP_DESCRIPTIONS[step]}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 pr-1">
          {step === "upload" && (
            <LeadFileDropzone
              onFileSelected={handleFileSelected}
              onError={(message) => toast.error(message)}
              disabled={isParsing}
            />
          )}
          {step === "mapping" && (
            <LeadFieldMapper
              columns={columns}
              rows={rows}
              mapping={mapping}
              onMappingChange={handleMappingChange}
            />
          )}
          {step === "statuses" && (
            <LeadStatusMapper
              distinctValues={distinctStatusValues}
              statusMapping={statusMapping}
              onStatusMappingChange={handleStatusMappingChange}
            />
          )}
          {step === "summary" && (
            <LeadImportSummary
              fileName={fileName}
              totalRows={buildMappedRows().length}
              mapping={mapping}
              statusMapping={statusMapping}
              result={result}
            />
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
              <Button variant="ghost" onClick={resetState}>
                <ArrowLeft className="mr-2 size-4" />
                Trocar arquivo
              </Button>
              <Button
                onClick={() => (hasStatusStep ? goToStatusStep() : setStep("summary"))}
                disabled={!areRequiredFieldsMapped}
              >
                Continuar
              </Button>
            </>
          )}
          {step === "statuses" && (
            <>
              <Button variant="ghost" onClick={() => setStep("mapping")}>
                <ArrowLeft className="mr-2 size-4" />
                Voltar
              </Button>
              <Button onClick={() => setStep("summary")}>Continuar</Button>
            </>
          )}
          {step === "summary" && !result && (
            <>
              <Button
                variant="ghost"
                onClick={() => setStep(hasStatusStep ? "statuses" : "mapping")}
                disabled={isSubmitting}
              >
                <ArrowLeft className="mr-2 size-4" />
                Voltar
              </Button>
              <Button onClick={handleImport} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  "Importar leads"
                )}
              </Button>
            </>
          )}
          {step === "summary" && result && (
            <Button onClick={() => handleOpenChange(false)}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
