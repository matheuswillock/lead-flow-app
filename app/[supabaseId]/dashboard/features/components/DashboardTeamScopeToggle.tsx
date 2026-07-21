'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useDashboardContext } from '../context/DashboardContext';
import type { DashboardTeamScope } from '../context/DashboardTypes';

export function DashboardTeamScopeToggle() {
  const { teamScope, setTeamScope, canUseAllTeamsScope } = useDashboardContext();

  if (!canUseAllTeamsScope) {
    return null;
  }

  return (
    <ToggleGroup
      type="single"
      value={teamScope}
      onValueChange={(value) => {
        if (value === 'active' || value === 'all') {
          setTeamScope(value as DashboardTeamScope);
        }
      }}
      variant="outline"
      size="sm"
      aria-label="Escopo do dashboard"
    >
      <ToggleGroupItem value="active" aria-label="Time ativo">
        Time ativo
      </ToggleGroupItem>
      <ToggleGroupItem value="all" aria-label="Todos os times">
        Todos os times
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
