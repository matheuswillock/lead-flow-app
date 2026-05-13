export function PmeSimulatorHeader() {
  return (
    <header className="flex flex-col gap-2">
      <h1 className="text-4xl font-light leading-none tracking-tight text-foreground">
        Simulador de
        <br />
        <strong className="font-bold">Planos de Saude</strong>
      </h1>
      <p className="text-sm text-muted-foreground">
        Digite as idades dos beneficiarios e selecione o hospital de referencia
      </p>
    </header>
  );
}
