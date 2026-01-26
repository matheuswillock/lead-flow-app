import usePipelineContext from "../context/PipelineHook";
import LeadDialog from "@/app/[supabaseId]/components/LeadDialog";

export default function PipelineDialog() {
  const { open, setOpen, selected: lead, user, userLoading, refreshLeads, finalizeContract } = usePipelineContext();

  return (
    <LeadDialog
      open={open}
      setOpen={setOpen}
      lead={lead}
      user={user}
      userLoading={userLoading}
      refreshLeads={refreshLeads}
      finalizeContract={finalizeContract}
    />
  );
}
