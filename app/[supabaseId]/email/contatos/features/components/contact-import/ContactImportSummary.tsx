"use client";

import { AlertCircle, FileCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ImportMappingHeader } from "@/components/import/ImportMappingHeader";
import type { ContactImportPreview } from "@/lib/emailContactImport/buildContactImportPreview";
import type { ContactImportBlock } from "@/lib/emailContactImport/evaluateContactImportBlocks";
import { EMAIL_CONTACT_IMPORT_FIELDS } from "@/lib/emailContactImport/emailContactImportFields";
import type { EmailContactImportFieldKey } from "@/lib/emailContactImport/emailContactImportFields";
import type { EmailContactImportMapping } from "./autoMapEmailContactColumns";
import { ContactImportPreviewCard } from "./ContactImportPreviewCard";

interface ContactImportSummaryProps {
  fileName: string;
  preview: ContactImportPreview;
  mapping: EmailContactImportMapping;
  blocks: ContactImportBlock[];
}

export function ContactImportSummary({
  fileName,
  preview,
  mapping,
  blocks,
}: ContactImportSummaryProps) {
  const mappedFields = EMAIL_CONTACT_IMPORT_FIELDS.filter(
    (field) => mapping[field.key as EmailContactImportFieldKey]
  );
  const isBlocked = blocks.length > 0;

  if (isBlocked) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Não podemos importar por causa do seguinte:</AlertTitle>
        <AlertDescription>
          <ul className="flex list-disc flex-col gap-1 pl-4">
            {blocks.map((block) => (
              <li key={block.kind}>{block.message}</li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
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
          {preview.skippedCount > 0
            ? ` ${preview.skippedCount === 1
                ? "1 e-mail não será incluído porque não é um e-mail válido."
                : `${preview.skippedCount} e-mails não serão incluídos porque não são e-mails válidos.`}`
            : ""}
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
        A importação será processada em segundo plano. Você receberá uma notificação quando
        concluir.
      </p>
    </div>
  );
}
