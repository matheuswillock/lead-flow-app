"use client";

import { CheckCircle2, FileCheck, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ImportMappingHeader } from "@/components/import/ImportMappingHeader";
import { ImportProgressSummary } from "@/components/import/ImportProgressSummary";
import type { ContactImportPreview } from "@/lib/emailContactImport/buildContactImportPreview";
import { EMAIL_CONTACT_IMPORT_FIELDS } from "@/lib/emailContactImport/emailContactImportFields";
import type { EmailContactImportFieldKey } from "@/lib/emailContactImport/emailContactImportFields";
import type { EmailContactImportMapping } from "./autoMapEmailContactColumns";
import type { EmailContactImportResult } from "../../services/IContatosService";
import { ContactImportPreviewCard } from "./ContactImportPreviewCard";

interface ContactImportSummaryProps {
  fileName: string;
  preview: ContactImportPreview;
  mapping: EmailContactImportMapping;
  isSubmitting: boolean;
  importProgress?: { processed: number; total: number } | null;
  result: EmailContactImportResult | null;
}

export function ContactImportSummary({
  fileName,
  preview,
  mapping,
  isSubmitting,
  importProgress,
  result,
}: ContactImportSummaryProps) {
  const mappedFields = EMAIL_CONTACT_IMPORT_FIELDS.filter(
    (field) => mapping[field.key as EmailContactImportFieldKey]
  );

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertTitle>Importação concluída</AlertTitle>
          <AlertDescription>
            {result.imported} {result.imported === 1 ? "contato adicionado" : "contatos adicionados"}{" "}
            e {result.updated} {result.updated === 1 ? "atualizado" : "atualizados"} a partir do
            arquivo {fileName}.
          </AlertDescription>
        </Alert>
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="outline"
            className="gap-1 border-semantic-success-border bg-semantic-success-surface text-semantic-success"
          >
            <CheckCircle2 className="size-3" />
            Adicionados: {result.imported}
          </Badge>
          {result.updated > 0 && (
            <Badge variant="outline" className="gap-1">
              Atualizados: {result.updated}
            </Badge>
          )}
          {result.skipped > 0 && (
            <Badge
              variant="outline"
              className="gap-1 border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger"
            >
              <XCircle className="size-3" />
              Ignorados: {result.skipped}
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
                      {issue.email || issue.name || "Sem identificação"}
                    </span>
                    <span className="text-xs text-muted-foreground">{issue.reason}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className="shrink-0 gap-1 border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger"
                  >
                    <XCircle className="size-3" />
                    Ignorado
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
          {preview.importableCount}{" "}
          {preview.importableCount === 1 ? "contato será importado" : "contatos serão importados"}{" "}
          do arquivo {fileName}.
        </AlertDescription>
      </Alert>

      <ContactImportPreviewCard preview={preview} variant="detailed" />

      <Separator />
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Campos mapeados</p>
        <ImportMappingHeader left="Campo do Corretor Studio" right="Coluna do seu arquivo" />
        <div className="flex flex-col gap-1.5">
          {mappedFields.map((field) => (
            <div key={field.key} className="flex items-center justify-between gap-2 text-sm">
              <span>{field.label}</span>
              <Badge variant="outline">{mapping[field.key as EmailContactImportFieldKey]}</Badge>
            </div>
          ))}
        </div>
      </div>
      <Separator />
      <p className="text-sm text-muted-foreground">
        Contatos com e-mail inválido ou duplicado na mesma linha serão ignorados e listados no
        resumo final.
      </p>
      {isSubmitting && importProgress ? (
        <ImportProgressSummary
          mapped={importProgress.processed}
          total={importProgress.total}
          label="contatos importados"
        />
      ) : null}
    </div>
  );
}
