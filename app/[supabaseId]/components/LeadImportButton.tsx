"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTeamContext } from "@/app/context/TeamContext";
import { LeadImportDialog } from "./lead-import/LeadImportDialog";

interface LeadImportButtonProps {
  onImportComplete?: () => Promise<void> | void;
}

export default function LeadImportButton({ onImportComplete }: LeadImportButtonProps) {
  const params = useParams();
  const supabaseId = params.supabaseId as string | undefined;
  const { activeTeamId } = useTeamContext();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="cursor-pointer max-lg:h-11">
        <Upload className="mr-2 size-4" />
        Importar leads
      </Button>
      <LeadImportDialog
        open={open}
        onOpenChange={setOpen}
        supabaseId={supabaseId}
        teamId={activeTeamId}
        onImportComplete={onImportComplete}
      />
    </>
  );
}
