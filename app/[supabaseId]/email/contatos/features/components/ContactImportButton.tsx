"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useContactsContext } from "../context/ContactsContext";
import { ContactImportDialog } from "./contact-import/ContactImportDialog";

export function ContactImportButton() {
  const { selectedListId, refreshSelectedList } = useContactsContext();
  const [open, setOpen] = useState(false);

  if (!selectedListId) return null;

  const handleImportComplete = async () => {
    await refreshSelectedList();
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload data-icon="inline-start" />
        Importar contatos
      </Button>
      <ContactImportDialog
        open={open}
        onOpenChange={setOpen}
        listId={selectedListId}
        onImportComplete={handleImportComplete}
      />
    </>
  );
}
