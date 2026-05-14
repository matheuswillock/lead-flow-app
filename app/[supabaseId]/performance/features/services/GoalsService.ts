import type { IGoalsService } from './IGoalsService';
import type { CreateGoalInput } from '../context/GoalsTypes';

class GoalsServiceImpl implements IGoalsService {
  async createGoal(input: CreateGoalInput): Promise<void> {
    console.info('[GoalsService] createGoal', input);
    await new Promise((r) => setTimeout(r, 400));
  }
}

export const goalsService: IGoalsService = new GoalsServiceImpl();
