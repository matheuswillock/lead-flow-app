"use client";

import { useTheme } from "next-themes";
import "./psim.css";

/**
 * Casca visual do simulador (CSS portado do protótipo, escopado em .psim).
 * Segue o tema do app (botão do header global): `data-theme` força claro/escuro;
 * antes de resolver o tema, vale a preferência do sistema.
 */
export function PlanSimulatorShell({ client = false, children }: { client?: boolean; children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" || resolvedTheme === "light" ? resolvedTheme : undefined;
  return (
    <div className={client ? "psim client" : "psim"} data-theme={theme}>
      {children}
    </div>
  );
}
