"use client"

import { useRef } from "react"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useContactsContext } from "../context/ContactsContext"
import { Input } from "@/components/ui/input";

export function CsvUploadDropzone() {
  const { uploadingCsv, handleUploadCsv } = useContactsContext()
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    void handleUploadCsv(file)
    e.target.value = ""
  }

  return (
    <div>
      <Input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={uploadingCsv}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="mr-2 h-4 w-4" />
        {uploadingCsv ? "Importando..." : "Importar CSV"}
      </Button>
      <p className="mt-1 text-xs text-muted-foreground">
        Colunas esperadas: <span className="font-medium">e-mail</span> (obrigatório), name
      </p>
    </div>
  )
}
