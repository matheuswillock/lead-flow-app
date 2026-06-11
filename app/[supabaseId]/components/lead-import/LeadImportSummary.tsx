"use client";

import { AlertCircle, CheckCircle2, FileCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LEAD_IMPORT_FIELDS } from "@/lib/leadImport/leadImportFields";
import { getLeadImportStatusLabel } from "@/lib/leadImport/leadImportStatus";
import type { LeadImportMapping } from "./autoMapColumns";
import type { LeadStatusMapping } from "./LeadStatusMapper";
import type { LeadImportResult } from "./ILeadImportService";

interface LeadImportSummaryProps {
  fileName: string;
  totalRows: number;
  mapping: LeadImportMapping;
  statusMapping: LeadStatusMapping;
  result: LeadImportResult | null;
}

export function LeadImportSummary({
  fileName,
  totalRows,
  mapping,
  statusMapping,
  result,
}: LeadImportSummaryProps) {
  const mappedFields = LEAD_IMPORT_FIELDS.filter((field) => mapping[field.key]);
  const statusEntries = Object.entries(statusMapping);

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertTitle>Importação concluída</AlertTitle>
          <AlertDescription>
            {result.created} {result.created === 1 ? "lead criado" : "leads criados"} a partir do
            arquivo {fileName}.
          </AlertDescription>
        </Alert>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Criados: {result.created}</Badge>
          <Badge variant="secondary">Ignorados: {result.skipped}</Badge>
          {result.sanitized > 0 && <Badge variant="secondary">Ajustados: {result.sanitized}</Badge>}
        </div>
        {result.skipped > 0 && (
          <p className="text-sm text-muted-foreground">
            Linhas ignoradas incluem leads sem nome ou telefone e leads que já existem no time com
            o mesmo e-mail ou CNPJ.
          </p>
        )}
        {result.errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Alguns leads não puderam ser criados</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {result.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <FileCheck className="size-4" />
        <AlertTitle>Pronto para importar</AlertTitle>
        <AlertDescription>
          {totalRows} {totalRows === 1 ? "linha será processada" : "linhas serão processadas"} do
          arquivo {fileName}.
        </AlertDescription>
      </Alert>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Campos mapeados</p>
        <div className="flex items-center justify-between gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>Campo do Corretor Studio</span>
          <span>Coluna do seu arquivo</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {mappedFields.map((field) => (
            <div key={field.key} className="flex items-center justify-between gap-2 text-sm">
              <span>{field.label}</span>
              <Badge variant="outline">{mapping[field.key]}</Badge>
            </div>
          ))}
        </div>
      </div>
      {statusEntries.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Status mapeados</p>
            <div className="flex items-center justify-between gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span>Status no Corretor Studio</span>
              <span>Status do seu arquivo</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {statusEntries.map(([fileValue, status]) => (
                <div key={fileValue} className="flex items-center justify-between gap-2 text-sm">
                  <span>{getLeadImportStatusLabel(status)}</span>
                  <Badge variant="outline">&ldquo;{fileValue}&rdquo;</Badge>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      <Separator />
      <p className="text-sm text-muted-foreground">
        Leads que já existem no time com o mesmo e-mail ou CNPJ serão ignorados e contabilizados no
        resumo final.
      </p>
    </div>
  );
}
