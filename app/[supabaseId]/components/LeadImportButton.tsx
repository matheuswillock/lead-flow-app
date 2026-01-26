"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface LeadImportButtonProps {
  onImportComplete?: () => Promise<void> | void;
}

export default function LeadImportButton({ onImportComplete }: LeadImportButtonProps) {
  const params = useParams();
  const supabaseId = params.supabaseId as string | undefined;
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImport = async () => {
    if (!file) {
      toast.error("Selecione um arquivo .xlsx");
      return;
    }
    if (!supabaseId) {
      toast.error("Usuario nao identificado");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/v1/leads/import", {
        method: "POST",
        headers: {
          "x-supabase-user-id": supabaseId,
        },
        body: formData,
      });

      const result = await response.json();
      if (!response.ok || !result?.isValid) {
        const message = result?.errorMessages?.[0] || "Falha ao importar leads";
        toast.error(message);
        return;
      }

      const created = result?.result?.created ?? 0;
      const skipped = result?.result?.skipped ?? 0;
      const sanitized = result?.result?.sanitized ?? 0;

      toast.success(`Importacao concluida. Criados: ${created}.`);
      if (skipped > 0 || sanitized > 0) {
        toast.info(`Ignorados: ${skipped}. Ajustados: ${sanitized}.`);
      }

      setOpen(false);
      setFile(null);
      if (onImportComplete) {
        await onImportComplete();
      }
    } catch (error) {
      console.error("Erro ao importar leads:", error);
      toast.error("Erro ao importar leads");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/*
          <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="mr-2 size-4" />
        Importar leads
      </Button>
    */}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Importar leads</DialogTitle>
            <DialogDescription>Envie o arquivo .xlsx exportado do ClickUp.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="file"
              accept=".xlsx"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] || null
                setFile(nextFile)
              }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button onClick={handleImport} disabled={isSubmitting || !file}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  "Importar"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
