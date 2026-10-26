export class PreScheduleSlotConflictError extends Error {
  constructor() {
    super("Este horário de pré-agendamento já está lotado.");
    this.name = "PreScheduleSlotConflictError";
  }
}
