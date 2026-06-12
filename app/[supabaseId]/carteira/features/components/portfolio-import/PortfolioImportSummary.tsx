"use client";

import { CheckCircle2, FileCheck, Info, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PORTFOLIO_IMPORT_FIELDS } from "@/lib/portfolioImport/portfolioImportFields";
import type { PortfolioImportMapping } from "./autoMapPortfolioColumns";
import type {
  CarteiraImportResult,
  CarteiraImportSource,
} from "../../services/ICarteiraImportService";

export interface PortfolioImportCloserOption {
  id: string;
  label: string;
}

interface PortfolioImportSummaryProps {
  fileName: string;
  totalRows: number;
  mapping: PortfolioImportMapping;
  closers: PortfolioImportCloserOption[];
  closerId: string;
  onCloserChange: (closerId: string) => void;
  source: CarteiraImportSource;
  onSourceChange: (source: CarteiraImportSource) => void;
  isSubmitting: boolean;
  result: CarteiraImportResult | null;
}

export function PortfolioImportSummary({
  fileName,
  totalRows,
  mapping,
  closers,
  closerId,
  onCloserChange,
  source,
  onSourceChange,
  isSubmitting,
  result,
}: PortfolioImportSummaryProps) {
  const mappedFields = PORTFOLIO_IMPORT_FIELDS.filter((field) => mapping[field.key]);

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertTitle>Importação concluída</AlertTitle>
          <AlertDescription>
            {result.created} {result.created === 1 ? "cliente criado" : "clientes criados"} a
            partir do arquivo {fileName}.
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
          {result.skipped > 0 && (
            <Badge
              variant="outline"
              className="gap-1 border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger"
            >
              <XCircle className="size-3" />
              Recusados: {result.skipped}
            </Badge>
          )}
        </div>
        {result.issues.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Linhas que precisam de atenção</p>
            <div className="flex flex-col gap-1.5">
              {result.issues.map((issue, index) => (
                <div
                  key={`${issue.line ?? "linha"}-${index}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">
                      {issue.line ? `Linha ${issue.line} — ` : ""}
                      {issue.name}
                    </span>
                    <span className="text-xs text-muted-foreground">{issue.reason}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className="shrink-0 gap-1 border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger"
                  >
                    <XCircle className="size-3" />
                    Não importado
                  </Badge>
                </div>
              ))}
            </div>
          </div>
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

      <FieldGroupSettings
        closers={closers}
        closerId={closerId}
        onCloserChange={onCloserChange}
        source={source}
        onSourceChange={onSourceChange}
        isSubmitting={isSubmitting}
      />

      <Separator />
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
      <Separator />
      <p className="text-sm text-muted-foreground">
        Clientes que já existem no time com o mesmo e-mail ou CNPJ serão recusados e contabilizados
        no resumo final.
      </p>
    </div>
  );
}

function FieldGroupSettings({
  closers,
  closerId,
  onCloserChange,
  source,
  onSourceChange,
  isSubmitting,
}: {
  closers: PortfolioImportCloserOption[];
  closerId: string;
  onCloserChange: (closerId: string) => void;
  source: CarteiraImportSource;
  onSourceChange: (source: CarteiraImportSource) => void;
  isSubmitting: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Info className="size-4 text-muted-foreground" />
        Configurações da importação
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="portfolio-import-closer">Closer responsável</Label>
        <Select value={closerId || undefined} onValueChange={onCloserChange} disabled={isSubmitting}>
          <SelectTrigger id="portfolio-import-closer" className="w-full sm:w-72">
            <SelectValue placeholder="Selecione o closer dos clientes importados" />
          </SelectTrigger>
          <SelectContent>
            {closers.map((closer) => (
              <SelectItem key={closer.id} value={closer.id}>
                {closer.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Todos os clientes importados serão atribuídos a este closer.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Origem dos clientes</Label>
        <RadioGroup
          value={source}
          onValueChange={(value) => onSourceChange(value as CarteiraImportSource)}
          className="flex flex-col gap-2 sm:flex-row sm:gap-6"
          disabled={isSubmitting}
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="manual" id="portfolio-import-source-manual" />
            <Label htmlFor="portfolio-import-source-manual" className="font-normal">
              Manual
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="brokerage_transfer" id="portfolio-import-source-transfer" />
            <Label htmlFor="portfolio-import-source-transfer" className="font-normal">
              Transferência de corretagem
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}
