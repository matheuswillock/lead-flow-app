"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { LeadsFiltersLayout } from "@/app/[supabaseId]/components/leads-filters/LeadsFiltersLayout";
import { LeadsMultiFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsMultiFilter";
import { useTeamContext } from "@/app/context/TeamContext";
import { useTeamClosers, useTeamSdrs } from "@/hooks/useTeamMembersByFunction";
import { useMeetingsHeldContext } from "../../context/MeetingsHeldContext";

export function MeetingsHeldFiltersBar() {
  const params = useParams();
  const supabaseId = params.supabaseId as string | undefined;
  const { activeTeamId } = useTeamContext();
  const { filters, setFilter } = useMeetingsHeldContext();

  const { members: sdrMembers } = useTeamSdrs(supabaseId, activeTeamId);
  const { members: closerMembers } = useTeamClosers(supabaseId, activeTeamId);

  const sdrOptions = useMemo(
    () => sdrMembers.map((m) => ({ value: m.id, label: m.name || m.email })),
    [sdrMembers]
  );

  const closerOptions = useMemo(
    () => closerMembers.map((m) => ({ value: m.id, label: m.name || m.email })),
    [closerMembers]
  );

  const handleSdrChange = (values: string[]) => {
    const prev = filters.sdrId ? [filters.sdrId] : [];
    const added = values.filter((v) => !prev.includes(v));
    setFilter("sdrId", added[0] ?? "");
  };

  const handleCloserChange = (values: string[]) => {
    const prev = filters.closerId ? [filters.closerId] : [];
    const added = values.filter((v) => !prev.includes(v));
    setFilter("closerId", added[0] ?? "");
  };

  return (
    <LeadsFiltersLayout>
      {sdrOptions.length > 0 && (
        <LeadsMultiFilter
          title="SDR"
          options={sdrOptions}
          selectedValues={filters.sdrId ? [filters.sdrId] : []}
          onChange={handleSdrChange}
        />
      )}
      {closerOptions.length > 0 && (
        <LeadsMultiFilter
          title="Closer"
          options={closerOptions}
          selectedValues={filters.closerId ? [filters.closerId] : []}
          onChange={handleCloserChange}
        />
      )}
    </LeadsFiltersLayout>
  );
}
