"use client";

import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { ImportDialogHeader } from "@/components/import/ImportDialogHeader";
import { ImportProgressSummary } from "@/components/import/ImportProgressSummary";
import { ImportRequiredFooterHint } from "@/components/import/ImportRequiredFooterHint";
import { useTeamClosers } from "@/hooks/useTeamMembersByFunction";
import {
  PORTFOLIO_IMPORT_FIELDS,
  PORTFOLIO_IMPORT_MAX_ROWS,
  type PortfolioImportFieldKey,
  type PortfolioImportRow,
} from "@/lib/portfolioImport/portfolioImportFields";
import { LeadFileDropzone } from "@/app/[supabaseId]/components/lead-import/LeadFileDropzone";
import {
  parseLeadFile,
  type ParsedLeadRow,
} from "@/app/[supabaseId]/components/lead-import/leadFileParser";
import { PortfolioFieldMapper } from "./PortfolioFieldMapper";
import { PortfolioImportSummary } from "./PortfolioImportSummary";
import { autoMapPortfolioColumns, type PortfolioImportMapping } from "./autoMapPortfolioColumns";
import { carteiraImportService } from "../../services/CarteiraImportService";
import type {
  CarteiraImportResult,
  CarteiraImportSource,
} from "../../services/ICarteiraImportService";

type PortfolioImportStep = "upload" | "mapping" | "summary";

const STEP_TITLES: Record<PortfolioImportStep, string> = {
  upload: "Enviar arquivo",
  mapping: "Mapear campos",
  summary: "Confirmar importação",
};

const STEP_DESCRIPTIONS: Record<PortfolioImportStep, string> = {
  upload: "Envie uma planilha Excel (.xlsx), CSV (.csv) ou um arquivo JSON com os seus clientes.",
  mapping:
    "Relacione as colunas do seu arquivo com os campos do Corretor Studio. Cada campo explica para que serve.",
  summary: "Revise o mapeamento e as configurações antes de concluir a importação.",
};

interface PortfolioImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supabaseId?: string;
  teamId?: string | null;
  onImportComplete?: () => Promise<void> | void;
}

export function PortfolioImportDialog({
  open,
  onOpenChange,
  supabaseId,
  teamId,
  onImportComplete,
}: PortfolioImportDialogProps) {
  const [step, setStep] = useState<PortfolioImportStep>("upload");
  const [fileName, setFileName] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedLeadRow[]>([]);
  const [mapping, setMapping] = useState<PortfolioImportMapping>({});
  const [closerId, setCloserId] = useState("");
  const [source, setSource] = useState<CarteiraImportSource>("manual");
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<CarteiraImportResult | null>(null);
  const [importProgress, setImportProgress] = useState<{
    processed: number;
    total: number;
  } | null>(null);

  const { members: closerMembers } = useTeamClosers(supabaseId, teamId ?? undefined);

  const resetState = () => {
    setStep("upload");
    setFileName("");
    setColumns([]);
    setRows([]);
    setMapping({});
    setCloserId("");
    setSource("manual");
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
      if (parsed.rows.length > PORTFOLIO_IMPORT_MAX_ROWS) {
        toast.error(
          `O arquivo tem ${parsed.rows.length} linhas. O limite é de ${PORTFOLIO_IMPORT_MAX_ROWS} por importação — divida o arquivo e tente novamente.`
        );
        return;
      }
      setFileName(file.name);
      setColumns(parsed.columns);
      setRows(parsed.rows);
      setMapping(autoMapPortfolioColumns(parsed.columns));
      setStep("mapping");
    } catch (error) {
      console.error("Erro ao ler arquivo de clientes:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível ler o arquivo");
    } finally {
      setIsParsing(false);
    }
  };

  const handleMappingChange = (field: PortfolioImportFieldKey, column: string | undefined) => {
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

  const buildMappedRows = (): PortfolioImportRow[] => {
    const entries = Object.entries(mapping) as [PortfolioImportFieldKey, string][];
    return rows.map((row) => {
      const mapped: PortfolioImportRow = { line: row.line };
      entries.forEach(([field, column]) => {
        const value = row.values[column]?.trim();
        if (value) {
          mapped[field] = value;
        }
      });
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
      toast.error("Selecione um time para importar clientes");
      return;
    }
    if (!closerId) {
      toast.error("Selecione o closer responsável pelos clientes importados");
      return;
    }

    const mappedRows = buildMappedRows();
    const hasImportableRow = mappedRows.some((row) => Boolean(row.name) && Boolean(row.phone));
    if (!hasImportableRow) {
      toast.error(
        "Nenhuma linha do arquivo tem valor nas colunas mapeadas para nome e telefone do cliente"
      );
      return;
    }

    setIsSubmitting(true);
    setImportProgress({ processed: 0, total: mappedRows.length });
    try {
      const importResult = await carteiraImportService.importMappedClientsInBatches(
        mappedRows,
        {
          supabaseId,
          teamId,
          closerId,
          source,
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
      console.error("Erro ao importar clientes:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao importar clientes");
      setImportProgress(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const requiredFieldKeys: PortfolioImportFieldKey[] = [
    "name",
    "phone",
    "operadora",
    "amount",
    "startDateAt",
  ];
  const requiredPendingCount = requiredFieldKeys.filter((key) => !mapping[key]).length;
  const requiredFieldsMapped = requiredPendingCount === 0;
  const mappedFieldCount = Object.keys(mapping).length;
  const stepIndex = step === "upload" ? 1 : step === "mapping" ? 2 : 3;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-2xl">
        <ImportDialogHeader
          title="Importar clientes"
          stepIndex={stepIndex}
          totalSteps={3}
          stepTitle={STEP_TITLES[step]}
          stepDescription={STEP_DESCRIPTIONS[step]}
        />

        {step === "mapping" && (
          <ImportProgressSummary
            mapped={mappedFieldCount}
            total={PORTFOLIO_IMPORT_FIELDS.length}
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
            <PortfolioFieldMapper
              columns={columns}
              rows={rows.map((row) => row.values)}
              mapping={mapping}
              onMappingChange={handleMappingChange}
            />
          )}
          {step === "summary" && (
            <PortfolioImportSummary
              fileName={fileName}
              totalRows={buildMappedRows().length}
              mapping={mapping}
              closers={closerMembers.map((member) => ({
                id: member.id,
                label: member.name || member.email,
              }))}
              closerId={closerId}
              onCloserChange={setCloserId}
              source={source}
              onSourceChange={setSource}
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
                <Button onClick={() => setStep("summary")} disabled={!requiredFieldsMapped}>
                  Continuar
                </Button>
              </div>
            </>
          )}
          {step === "summary" && !result && (
            <>
              <Button variant="ghost" onClick={() => setStep("mapping")} disabled={isSubmitting}>
                <ArrowLeft className="mr-2 size-4" />
                Voltar
              </Button>
              <Button onClick={handleImport} disabled={isSubmitting || !closerId}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  "Importar clientes"
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
