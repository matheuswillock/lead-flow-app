"use client"

import { BookUser } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useContatosContext } from "../context/ContatosContext"
import { ContactListPanel } from "../components/ContactListPanel"
import { ContactListCreateModal } from "../components/ContactListCreateModal"
import { ContactsTable } from "../components/ContactsTable"
import { CsvUploadDropzone } from "../components/CsvUploadDropzone"

export function ContatosContainer() {
  const { selectedListId, lists } = useContatosContext()

  const selectedList = lists.find((l) => l.id === selectedListId) ?? null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookUser className="h-6 w-6" />
          <h1 className="text-2xl font-semibold">Contatos</h1>
        </div>
        <ContactListCreateModal
          trigger={
            <Button size="sm">+ Nova Lista</Button>
          }
        />
      </div>

      <div className="flex gap-6">
        {/* Left panel — list of contact lists */}
        <div className="w-64 shrink-0 space-y-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Listas
          </p>
          <ContactListPanel />
        </div>

        <Separator orientation="vertical" className="h-auto" />

        {/* Right panel — contacts */}
        <div className="flex-1 min-w-0 space-y-4">
          {!selectedListId ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-24 text-center">
              <BookUser className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Selecione uma lista para visualizar os contatos
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{selectedList?.name}</h2>
                <CsvUploadDropzone />
              </div>
              <ContactsTable />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
