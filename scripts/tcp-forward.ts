#!/usr/bin/env bun

/**
 * tcp-forward.ts
 *
 * Encaminhador TCP minimo: escuta em `listenPort` e repassa cada conexao para
 * `127.0.0.1:targetPort`. Usado pelo `e2e:ci` porque o `migrate.sh` da imagem
 * supabase/postgres tem a porta 5432 fixa (ignora PGPORT), enquanto o seed e os
 * testes do projeto falam com 127.0.0.1:55322. Sem dependencias externas.
 *
 * Uso: bun scripts/tcp-forward.ts <listenPort> <targetPort>
 */

import net from "node:net";

export interface TcpForwarder {
  port: number;
  close(): Promise<void>;
}

const LOOPBACK = "127.0.0.1";

export function startTcpForwarder(
  listenPort: number,
  targetPort: number,
  host: string = LOOPBACK,
): Promise<TcpForwarder> {
  return new Promise((resolve, reject) => {
    const server = net.createServer((client) => {
      const upstream = net.connect({ host, port: targetPort });
      const destroyBoth = () => {
        client.destroy();
        upstream.destroy();
      };

      client.pipe(upstream);
      upstream.pipe(client);
      client.on("error", destroyBoth);
      upstream.on("error", destroyBoth);
      client.on("close", destroyBoth);
      upstream.on("close", destroyBoth);
    });

    server.once("error", reject);
    server.listen(listenPort, host, () => {
      const address = server.address();
      resolve({
        port: typeof address === "object" && address ? address.port : listenPort,
        close: () =>
          new Promise<void>((resolveClose) => {
            server.close(() => resolveClose());
          }),
      });
    });
  });
}

export function parsePort(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const port = Number(value);
  return port >= 1 && port <= 65535 ? port : null;
}

async function main(argv: string[]): Promise<number> {
  const listenPort = parsePort(argv[0]);
  const targetPort = parsePort(argv[1]);
  if (listenPort === null || targetPort === null) {
    console.error("Uso: bun scripts/tcp-forward.ts <listenPort> <targetPort>");
    return 1;
  }

  const forwarder = await startTcpForwarder(listenPort, targetPort);
  console.info(
    `[tcp-forward] ${LOOPBACK}:${forwarder.port} -> ${LOOPBACK}:${targetPort}`,
  );
  // Fica vivo ate ser encerrado (SIGTERM/SIGINT).
  await new Promise<void>((resolveStop) => {
    process.once("SIGTERM", resolveStop);
    process.once("SIGINT", resolveStop);
  });
  await forwarder.close();
  return 0;
}

if (import.meta.main) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error("[tcp-forward] erro fatal:", error);
      process.exit(1);
    },
  );
}
