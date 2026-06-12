"use client";

import { AlertCircle, CheckCircle2, FileCheck, Info, TriangleAlert, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { LEAD_IMPORT_FIELDS } from "@/lib/leadImport/leadImportFields";
import { getLeadImportStatusLabel } from "@/lib/leadImport/leadImportStatus";
import type { LeadImportMapping } from "./autoMapColumns";
import type { LeadStatusMapping } from "./LeadStatusMapper";
import type { LeadSoldPlanMapping } from "./LeadSoldPlanMapper";
import type { LeadImportOutcome, LeadImportResult } from "./ILeadImportService";

interface LeadImportSummaryProps {
  fileName: string;
  totalRows: number;
  mapping: LeadImportMapping;
  statusMapping: LeadStatusMapping;
  planMapping: LeadSoldPlanMapping;
  result: LeadImportResult | null;
}

const OUTCOME_BADGES: Record<
  LeadImportOutcome["outcome"],
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  created: {
    label: "Criado",
    className: "border-semantic-success-border bg-semantic-success-surface text-semantic-success",
    icon: CheckCircle2,
  },
  created_default_status: {
    label: "Criado como Nova oportunidade",
    className: "border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning",
    icon: TriangleAlert,
  },
  skipped: {
    label: "Recusado",
    className: "border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger",
    icon: XCircle,
  },
};

function LeadOutcomeList({ leads }: { leads: LeadImportOutcome[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {leads.map((lead, index) => {
        const badge = OUTCOME_BADGES[lead.outcome];
        const BadgeIcon = badge.icon;
        return (
          <div
            key={`${lead.name}-${index}`}
            className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
          >
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{lead.name}</span>
              {lead.reason && (
                <span className="text-xs text-muted-foreground">{lead.reason}</span>
              )}
            </div>
            <Badge variant="outline" className={cn("shrink-0 gap-1", badge.className)}>
              <BadgeIcon className="size-3" />
              {badge.label}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

export function LeadImportSummary({
  fileName,
  totalRows,
  mapping,
  statusMapping,
  planMapping,
  result,
}: LeadImportSummaryProps) {
  const mappedFields = LEAD_IMPORT_FIELDS.filter((field) => mapping[field.key]);
  const statusEntries = Object.entries(statusMapping);
  const planEntries = Object.entries(planMapping);

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
          <Badge
            variant="outline"
            className="gap-1 border-semantic-success-border bg-semantic-success-surface text-semantic-success"
          >
            <CheckCircle2 className="size-3" />
            Criados: {result.created}
          </Badge>
          {result.createdWithDefaultStatus > 0 && (
            <Badge
              variant="outline"
              className="gap-1 border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning"
            >
              <TriangleAlert className="size-3" />
              Como Nova oportunidade: {result.createdWithDefaultStatus}
            </Badge>
          )}
          {result.skipped > 0 && (
            <Badge
              variant="outline"
              className="gap-1 border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger"
            >
              <XCircle className="size-3" />
              Recusados: {result.skipped}
            </Badge>
          )}
          {result.sanitized > 0 && <Badge variant="secondary">Ajustados: {result.sanitized}</Badge>}
        </div>
        {result.leads.length > 0 && <LeadOutcomeList leads={result.leads} />}
        {result.skipped > 0 && (
          <p className="text-sm text-muted-foreground">
            Linhas recusadas incluem leads sem nome ou telefone e leads que já existem no time com
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
      <Alert>
        <Info className="size-4" />
        <AlertDescription>
          Leads sem mapeamento de status entrarão no funil como Nova oportunidade.
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
      {planEntries.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Planos vendidos mapeados</p>
            <div className="flex items-center justify-between gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span>Plano no Corretor Studio</span>
              <span>Plano do seu arquivo</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {planEntries.map(([fileValue, planName]) => (
                <div key={fileValue} className="flex items-center justify-between gap-2 text-sm">
                  <span className={cn(!planName && "text-muted-foreground")}>
                    {planName || "Não importar"}
                  </span>
                  <Badge variant="outline">&ldquo;{fileValue}&rdquo;</Badge>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      <Separator />
      <p className="text-sm text-muted-foreground">
        Leads que já existem no time com o mesmo e-mail ou CNPJ serão recusados e contabilizados no
        resumo final.
      </p>
    </div>
  );
}
