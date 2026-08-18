"use client";

import { CircleAlert, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ContactImportPreview } from "@/lib/emailContactImport/buildContactImportPreview";

interface ContactImportPreviewCardProps {
  preview: ContactImportPreview;
  variant?: "compact" | "detailed";
}

function skippedCountLabel(count: number): string {
  return count === 1
    ? "1 e-mail não será incluído porque não é um e-mail válido."
    : `${count} e-mails não serão incluídos porque não são e-mails válidos.`;
}

export function ContactImportPreviewCard({
  preview,
  variant = "compact",
}: ContactImportPreviewCardProps) {
  const {
    importableCount,
    skippedCount,
    skippedIssues,
    skippedReasonCounts,
    preview: sampleContacts,
  } = preview;

  if (importableCount === 0 && skippedCount === 0) {
    return null;
  }

  const showSkippedDetails = skippedCount > 0;

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
            <p className="text-xs text-muted-foreground">{skippedCountLabel(skippedCount)}</p>
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
              {skippedCount} recusados
            </Badge>
          ) : null}
        </div>
      </div>

      {showSkippedDetails ? (
        <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
          <div className="flex items-start gap-2">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <p className="text-xs font-medium">
                Por que esses e-mails não entram na lista
              </p>
              <ul className="flex flex-col gap-1">
                {skippedReasonCounts.map((item) => (
                  <li
                    key={item.reason}
                    className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground"
                  >
                    <span>{item.reason}</span>
                    <span className="shrink-0 tabular-nums">{item.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {variant === "detailed" && skippedIssues.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Exemplos recusados
              </p>
              <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                {skippedIssues.map((issue) => (
                  <div
                    key={`${issue.line ?? "row"}-${issue.email}-${issue.reason}`}
                    className="flex flex-col gap-0.5 rounded-md bg-destructive/5 px-2.5 py-1.5 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{issue.email}</span>
                      {typeof issue.line === "number" ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          Linha {issue.line}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-xs text-muted-foreground">{issue.reason}</span>
                  </div>
                ))}
              </div>
              {skippedCount > skippedIssues.length ? (
                <p className="text-xs text-muted-foreground">
                  e mais {skippedCount - skippedIssues.length}{" "}
                  {skippedCount - skippedIssues.length === 1 ? "linha" : "linhas"}...
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

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
