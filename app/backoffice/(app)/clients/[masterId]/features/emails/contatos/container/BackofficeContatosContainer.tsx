"use client"

import { BookUser } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useBackofficeContatos } from "../hooks/useBackofficeContatos"
import { BackofficeContactListPanel } from "../components/BackofficeContactListPanel"
import { BackofficeContactListCreateModal } from "../components/BackofficeContactListCreateModal"
import { BackofficeContactAddModal } from "../components/BackofficeContactAddModal"
import { BackofficeContactsTable } from "../components/BackofficeContactsTable"
import { BackofficeContactImportButton } from "../components/BackofficeContactImportButton"

export function BackofficeContatosContainer() {
  const contatos = useBackofficeContatos()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Gerencie listas e contatos de e-mail do time selecionado.
        </p>
        <BackofficeContactListCreateModal
          canManage={contatos.canManage}
          creatingList={contatos.creatingList}
          handleCreateList={contatos.handleCreateList}
        />
      </div>

      <div className="flex flex-col gap-2 lg:hidden">
        <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Listas
        </p>
        <Select
          value={contatos.selectedListId ?? ""}
          onValueChange={(value) => contatos.handleSelectList(value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione uma lista" />
          </SelectTrigger>
          <SelectContent>
            {contatos.lists.map((list) => (
              <SelectItem key={list.id} value={list.id}>
                {list.name} ({list.totalContacts.toLocaleString("pt-BR")})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="hidden w-64 shrink-0 flex-col gap-2 lg:flex">
          <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Listas
          </p>
          <BackofficeContactListPanel {...contatos} />
        </div>

        <Separator orientation="vertical" className="hidden h-auto lg:block" />

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {!contatos.selectedListId ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-24 text-center">
              <BookUser className="mb-3 size-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Selecione uma lista para visualizar os contatos
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">{contatos.selectedList?.name}</h2>
                {!contatos.selectedList?.isBlocklist && contatos.canManage ? (
                  <div className="flex items-center gap-2">
                    <BackofficeContactAddModal
                      canManage={contatos.canManage}
                      addingContact={contatos.addingContact}
                      handleAddContact={contatos.handleAddContact}
                    />
                    <BackofficeContactImportButton
                      canManage={contatos.canManage}
                      uploading={contatos.uploading}
                      handleUploadContacts={contatos.handleUploadContacts}
                      selectedListId={contatos.selectedListId}
                      listName={contatos.selectedList?.name}
                    />
                  </div>
                ) : contatos.selectedList?.isBlocklist ? (
                  <p className="text-sm text-muted-foreground">
                    Lista somente leitura — contatos entram via descadastro.
                  </p>
                ) : null}
              </div>
              <BackofficeContactsTable {...contatos} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
