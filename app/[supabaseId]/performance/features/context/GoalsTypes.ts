export type GoalIndicator = 'vendas' | 'receita' | 'reunioes' | 'agendamentos' | 'no-show';
export type GoalPeriod = 'semanal' | 'mensal' | 'trimestral';
export type GoalAppliesTo = 'equipe' | 'individual';

export interface CreateGoalInput {
  indicator: GoalIndicator;
  period: GoalPeriod;
  appliesTo: GoalAppliesTo;
  startDate: string;
  endDate: string;
  targetValue: number;
  reward?: string;
  notifyTeam: boolean;
}
