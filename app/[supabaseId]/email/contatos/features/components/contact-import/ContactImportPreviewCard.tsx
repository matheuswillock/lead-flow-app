"use client";

import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ContactImportPreview } from "@/lib/emailContactImport/buildContactImportPreview";

interface ContactImportPreviewCardProps {
  preview: ContactImportPreview;
  variant?: "compact" | "detailed";
}

export function ContactImportPreviewCard({
  preview,
  variant = "compact",
}: ContactImportPreviewCardProps) {
  const { importableCount, skippedCount, preview: sampleContacts } = preview;

  if (importableCount === 0 && skippedCount === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-1 px-3.5 py-3">
      <div className="flex items-start gap-2.5">
        <Users className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-sm font-medium">
            {importableCount}{" "}
            {importableCount === 1 ? "contato será importado" : "contatos serão importados"}
          </p>
          {skippedCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              {skippedCount}{" "}
              {skippedCount === 1 ? "linha ignorada" : "linhas ignoradas"} por e-mail inválido ou
              ausente
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Todas as linhas do arquivo têm e-mail válido na coluna mapeada.
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          <Badge variant="secondary" className="text-[11px]">
            {importableCount} válidos
          </Badge>
          {skippedCount > 0 ? (
            <Badge variant="outline" className="text-[11px]">
              {skippedCount} ignorados
            </Badge>
          ) : null}
        </div>
      </div>

      {variant === "detailed" && sampleContacts.length > 0 ? (
        <div className="flex flex-col gap-1.5 border-t border-border/60 pt-3">
          <p className="text-xs font-medium text-muted-foreground">Prévia dos primeiros contatos</p>
          <div className="flex flex-col gap-1">
            {sampleContacts.map((contact) => (
              <div
                key={`${contact.line ?? "row"}-${contact.email}`}
                className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-sm"
              >
                <span className="truncate font-medium">{contact.email}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {contact.name || "—"}
                </span>
              </div>
            ))}
          </div>
          {importableCount > sampleContacts.length ? (
            <p className="text-xs text-muted-foreground">
              e mais {importableCount - sampleContacts.length}{" "}
              {importableCount - sampleContacts.length === 1 ? "contato" : "contatos"}...
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
