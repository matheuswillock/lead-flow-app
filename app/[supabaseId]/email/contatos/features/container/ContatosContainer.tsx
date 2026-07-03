"use client"

import { BookUser } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useContactsContext } from "../context/ContactsContext"
import { ContactListPanel } from "../components/ContactListPanel"
import { ContactListCreateModal } from "../components/ContactListCreateModal"
import { ContactAddModal } from "../components/ContactAddModal"
import { ContactsTable } from "../components/ContactsTable"
import { ContactImportButton } from "../components/ContactImportButton"

export function ContatosContainer() {
  const { selectedListId, lists, handleSelectList } = useContactsContext()

  const selectedList = lists.find((l) => l.id === selectedListId) ?? null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookUser className="size-6" />
          <h1 className="text-2xl font-semibold">Contatos</h1>
        </div>
        <ContactListCreateModal
          trigger={
            <Button size="sm">+ Nova Lista</Button>
          }
        />
      </div>

      {/* Mobile — list picker replaces the fixed sidebar below lg */}
      <div className="flex flex-col gap-2 lg:hidden">
        <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Listas
        </p>
        <Select
          value={selectedListId ?? ""}
          onValueChange={(value) => handleSelectList(value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione uma lista" />
          </SelectTrigger>
          <SelectContent>
            {lists.map((list) => (
              <SelectItem key={list.id} value={list.id}>
                {list.name} ({list.totalContacts.toLocaleString("pt-BR")})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left panel — list of contact lists (desktop only) */}
        <div className="hidden w-64 shrink-0 flex-col gap-2 lg:flex">
          <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Listas
          </p>
          <ContactListPanel />
        </div>

        <Separator orientation="vertical" className="hidden h-auto lg:block" />

        {/* Right panel — contacts */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {!selectedListId ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-24 text-center">
              <BookUser className="mb-3 size-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Selecione uma lista para visualizar os contatos
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">{selectedList?.name}</h2>
                <div className="flex items-center gap-2">
                  <ContactAddModal
                    trigger={
                      <Button size="sm" variant="outline">+ Adicionar contato</Button>
                    }
                  />
                  <ContactImportButton />
                </div>
              </div>
              <ContactsTable />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
