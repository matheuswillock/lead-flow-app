import type { Output } from "@/lib/output";

export interface IProfileTimezoneUseCase {
  /** Fuso horario configurado no perfil. */
  getTimezone(supabaseId: string): Promise<Output>;
  /**
   * Atualiza o fuso do perfil.
   *
   * O `result` carrega `affectedTeamIds` — os times em que esse perfil e master —
   * para o caller invalidar o bootstrap do formulario publico, que exibe o fuso
   * do master.
   */
  updateTimezone(supabaseId: string, timezone: string): Promise<Output>;
}
