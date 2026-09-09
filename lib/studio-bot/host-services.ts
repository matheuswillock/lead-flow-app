/**
 * Serviços do `docker-compose.vps.yml` que o agente Ops gerencia.
 *
 * Fica em `lib/` (e não no Service do agente) porque rotas e UI também precisam
 * da lista para validar payload e montar os selects — rota não pode importar
 * Service (governance:check).
 */
export const HOST_AGENT_SERVICES = ["openwa", "studio-bot-ops"] as const;

export type HostAgentService = (typeof HOST_AGENT_SERVICES)[number];

export const HOST_AGENT_SERVICE_LABELS: Record<HostAgentService, string> = {
  openwa: "OpenWA",
  "studio-bot-ops": "Agente Ops",
};

export function isHostAgentService(value: string): value is HostAgentService {
  return (HOST_AGENT_SERVICES as readonly string[]).includes(value);
}
