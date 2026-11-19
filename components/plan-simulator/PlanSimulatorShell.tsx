import "./psim.css";

/** Casca visual do simulador (CSS portado do protótipo, escopado em .psim). */
export function PlanSimulatorShell({ client = false, children }: { client?: boolean; children: React.ReactNode }) {
  return <div className={client ? "psim client" : "psim"}>{children}</div>;
}
