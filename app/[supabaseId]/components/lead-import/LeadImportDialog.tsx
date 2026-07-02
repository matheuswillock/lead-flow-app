"use client";

import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { ImportDialogHeader } from "@/components/import/ImportDialogHeader";
import { ImportProgressSummary } from "@/components/import/ImportProgressSummary";
import { ImportRequiredFooterHint } from "@/components/import/ImportRequiredFooterHint";
import {
  LEAD_IMPORT_FIELDS,
  LEAD_IMPORT_MAX_ROWS,
  type LeadImportFieldKey,
  type LeadImportRow,
} from "@/lib/leadImport/leadImportFields";
import { suggestLeadStatus, type LeadImportStatusKey } from "@/lib/leadImport/leadImportStatus";
import { buildHealthPlanOptionMap, mapHealthPlan } from "@/lib/leadImport/healthPlanMapping";
import { useHealthPlans } from "@/hooks/useHealthPlans";
import { LeadFileDropzone } from "./LeadFileDropzone";
import { LeadFieldMapper } from "./LeadFieldMapper";
import {
  LeadStatusMapper,
  type LeadStatusMapping,
  type LeadStatusValueCount,
} from "./LeadStatusMapper";
import { LeadSoldPlanMapper, type LeadSoldPlanMapping } from "./LeadSoldPlanMapper";
import { LeadImportSummary } from "./LeadImportSummary";
import { autoMapColumns, type LeadImportMapping } from "./autoMapColumns";
import { parseLeadFile, type ParsedLeadRow } from "./leadFileParser";
import { leadImportService } from "./LeadImportService";
import type { LeadImportResult } from "./ILeadImportService";

type LeadImportStep = "upload" | "mapping" | "statuses" | "plans" | "summary";

const STEP_TITLES: Record<LeadImportStep, string> = {
  upload: "Enviar arquivo",
  mapping: "Mapear campos",
  statuses: "Mapear status",
  plans: "Mapear planos vendidos",
  summary: "Confirmar importação",
};

const STEP_DESCRIPTIONS: Record<LeadImportStep, string> = {
  upload: "Envie uma planilha Excel (.xlsx) ou um arquivo JSON com os seus leads.",
  mapping:
    "Relacione as colunas do seu arquivo com os campos do Corretor Studio. Cada campo explica para que serve.",
  statuses:
    "Relacione os status encontrados no seu arquivo com os status do funil do Corretor Studio.",
  plans:
    "Relacione os planos vendidos encontrados no seu arquivo com as operadoras do Corretor Studio.",
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
  const [rows, setRows] = useState<ParsedLeadRow[]>([]);
  const [mapping, setMapping] = useState<LeadImportMapping>({});
  const [statusMapping, setStatusMapping] = useState<LeadStatusMapping>({});
  const [planMapping, setPlanMapping] = useState<LeadSoldPlanMapping>({});
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<LeadImportResult | null>(null);
  const [importProgress, setImportProgress] = useState<{
    processed: number;
    total: number;
  } | null>(null);

  const { healthPlans } = useHealthPlans(supabaseId, teamId);

  const resetState = () => {
    setStep("upload");
    setFileName("");
    setColumns([]);
    setRows([]);
    setMapping({});
    setStatusMapping({});
    setPlanMapping({});
    setIsParsing(false);
    setIsSubmitting(false);
    setResult(null);
    setImportProgress(null);
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
    if (field === "soldPlan") {
      setPlanMapping({});
    }
  };

  const getDistinctColumnValues = (column: string | undefined): LeadStatusValueCount[] => {
    if (!column) return [];
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      const value = row.values[column]?.trim();
      if (!value) return;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });
    return Array.from(counts.entries()).map(([value, count]) => ({ value, count }));
  };

  const distinctStatusValues = getDistinctColumnValues(mapping.status);
  const distinctSoldPlanValues = getDistinctColumnValues(mapping.soldPlan);
  const hasStatusStep = distinctStatusValues.length > 0;
  const hasPlanStep = distinctSoldPlanValues.length > 0;

  const stepsOrder: LeadImportStep[] = [
    "upload",
    "mapping",
    ...(hasStatusStep ? (["statuses"] as const) : []),
    ...(hasPlanStep ? (["plans"] as const) : []),
    "summary",
  ];

  const goToStep = (next: LeadImportStep) => {
    if (next === "statuses") {
      setStatusMapping((prev) => {
        const initialized: LeadStatusMapping = {};
        distinctStatusValues.forEach(({ value }) => {
          initialized[value] = prev[value] ?? suggestLeadStatus(value);
        });
        return initialized;
      });
    }
    if (next === "plans") {
      const planNames = healthPlans.map((plan) => plan.name);
      const planOptionMap = buildHealthPlanOptionMap(planNames);
      const othersPlan =
        planNames.find((plan) => plan.trim().toLowerCase() === "outros") ?? "Outros";
      setPlanMapping((prev) => {
        const initialized: LeadSoldPlanMapping = {};
        distinctSoldPlanValues.forEach(({ value }) => {
          initialized[value] = prev[value] || (mapHealthPlan(value, planOptionMap) ?? othersPlan);
        });
        return initialized;
      });
    }
    setStep(next);
  };

  const goToNextStep = () => {
    const nextStep = stepsOrder[stepsOrder.indexOf(step) + 1];
    if (nextStep) goToStep(nextStep);
  };

  const goToPreviousStep = () => {
    const previousStep = stepsOrder[stepsOrder.indexOf(step) - 1];
    if (previousStep) goToStep(previousStep);
  };

  const handleStatusMappingChange = (fileValue: string, status: LeadImportStatusKey) => {
    setStatusMapping((prev) => ({ ...prev, [fileValue]: status }));
  };

  const handlePlanMappingChange = (fileValue: string, planName: string) => {
    setPlanMapping((prev) => ({ ...prev, [fileValue]: planName }));
  };

  const buildMappedRows = (): LeadImportRow[] => {
    const entries = Object.entries(mapping) as [LeadImportFieldKey, string][];
    return rows.map((row) => {
      const mapped: LeadImportRow = { line: row.line };
      entries.forEach(([field, column]) => {
        const value = row.values[column]?.trim();
        if (value) {
          mapped[field] = value;
        }
      });
      if (mapped.status && statusMapping[mapped.status]) {
        mapped.status = statusMapping[mapped.status];
      }
      if (mapped.soldPlan && planMapping[mapped.soldPlan]) {
        mapped.soldPlan = planMapping[mapped.soldPlan];
      }
      return mapped;
    });
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
    const hasImportableRow = mappedRows.some((row) => Boolean(row.name) && Boolean(row.phone));
    if (!hasImportableRow) {
      toast.error(
        "Nenhuma linha do arquivo tem valor nas colunas mapeadas para nome e telefone do lead"
      );
      return;
    }

    setIsSubmitting(true);
    setImportProgress({ processed: 0, total: mappedRows.length });
    try {
      const importResult = await leadImportService.importMappedLeadsInBatches(
        mappedRows,
        {
          supabaseId,
          teamId,
        },
        {
          onProgress: (processed, total) => setImportProgress({ processed, total }),
        }
      );
      setResult(importResult);
      setImportProgress(null);
      toast.success(`Importação concluída. Criados: ${importResult.created}.`);
      if (onImportComplete) {
        await onImportComplete();
      }
    } catch (error) {
      console.error("Erro ao importar leads:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao importar leads");
      setImportProgress(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const requiredPendingCount =
    (mapping.name ? 0 : 1) + (mapping.phone ? 0 : 1);
  const areRequiredFieldsMapped = requiredPendingCount === 0;
  const mappedFieldCount = Object.keys(mapping).length;
  const totalSteps = stepsOrder.length;
  const stepIndex = stepsOrder.indexOf(step) + 1;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-2xl">
        <ImportDialogHeader
          title="Importar leads"
          stepIndex={stepIndex}
          totalSteps={totalSteps}
          stepTitle={STEP_TITLES[step]}
          stepDescription={STEP_DESCRIPTIONS[step]}
        />

        {step === "mapping" && (
          <ImportProgressSummary
            mapped={mappedFieldCount}
            total={LEAD_IMPORT_FIELDS.length}
            label="campos mapeados"
          />
        )}

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
              rows={rows.map((row) => row.values)}
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
          {step === "plans" && (
            <LeadSoldPlanMapper
              distinctValues={distinctSoldPlanValues}
              planOptions={healthPlans.map((plan) => plan.name)}
              planMapping={planMapping}
              onPlanMappingChange={handlePlanMappingChange}
            />
          )}
          {step === "summary" && (
            <LeadImportSummary
              fileName={fileName}
              totalRows={buildMappedRows().length}
              mapping={mapping}
              statusMapping={statusMapping}
              planMapping={planMapping}
              isSubmitting={isSubmitting}
              importProgress={importProgress}
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
              <Button variant="ghost" onClick={resetState} className="sm:mr-auto">
                <ArrowLeft className="mr-2 size-4" />
                Trocar arquivo
              </Button>
              <div className="flex items-center gap-3">
                <ImportRequiredFooterHint pendingCount={requiredPendingCount} />
                <Button onClick={goToNextStep} disabled={!areRequiredFieldsMapped}>
                  Continuar
                </Button>
              </div>
            </>
          )}
          {(step === "statuses" || step === "plans") && (
            <>
              <Button variant="ghost" onClick={goToPreviousStep}>
                <ArrowLeft className="mr-2 size-4" />
                Voltar
              </Button>
              <Button onClick={goToNextStep}>Continuar</Button>
            </>
          )}
          {step === "summary" && !result && (
            <>
              <Button variant="ghost" onClick={goToPreviousStep} disabled={isSubmitting}>
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
