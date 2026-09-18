"use client"

import type { ReactNode } from "react"
import type { ContactListActiveImport } from "../context/ContatosTypes"
import { ContactImportStatusBadge } from "./ContactImportStatusBadge"
import { resolveImportVerdictLine } from "../utils/contact-import-status"

type ContatosSelectedListHeaderProps = {
  listName: string
  activeImport?: ContactListActiveImport | null
  actions?: ReactNode
}

export function ContatosSelectedListHeader({
  listName,
  activeImport,
  actions,
}: ContatosSelectedListHeaderProps) {
  const verdictLine = activeImport ? resolveImportVerdictLine(activeImport) : null

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="font-semibold">{listName}</h2>
          {activeImport ? (
            <ContactImportStatusBadge activeImport={activeImport} showProgress />
          ) : null}
        </div>
        {actions}
      </div>
      {verdictLine ? (
        <p data-testid="import-verdict-line" className="text-xs text-muted-foreground">
          {verdictLine}
        </p>
      ) : null}
    </div>
  )
}
