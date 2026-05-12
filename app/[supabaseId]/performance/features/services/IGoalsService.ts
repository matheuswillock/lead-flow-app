import type { CreateGoalInput } from '../context/GoalsTypes';

export interface IGoalsService {
  createGoal(input: CreateGoalInput): Promise<void>;
}
