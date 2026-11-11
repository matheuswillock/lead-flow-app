import { afterEach, describe, expect, it } from "bun:test";
import net from "node:net";

import { parsePort, startTcpForwarder, type TcpForwarder } from "./tcp-forward";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

function startEchoServer(): Promise<{ port: number }> {
  return new Promise((resolve) => {
    const server = net.createServer((socket) => {
      socket.on("error", () => {});
      socket.pipe(socket);
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as net.AddressInfo;
      cleanups.push(
        () => new Promise<void>((done) => server.close(() => done())),
      );
      resolve({ port: address.port });
    });
  });
}

function roundTrip(port: number, payload: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    let received = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      received += chunk;
      if (received.length >= payload.length) {
        socket.end();
        resolve(received);
      }
    });
    socket.on("error", reject);
    socket.write(payload);
  });
}

function connectAndWaitForClose(port: number): Promise<"closed"> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.on("error", () => {});
    socket.on("close", () => resolve("closed"));
    socket.write("ping");
  });
}

async function freePort(): Promise<number> {
  const probe = await startTcpForwarder(0, 1);
  const { port } = probe;
  await probe.close();
  return port;
}

describe("startTcpForwarder", () => {
  it("repassa os bytes nos dois sentidos para a porta de destino", async () => {
    const echo = await startEchoServer();
    const forwarder: TcpForwarder = await startTcpForwarder(0, echo.port);
    cleanups.push(() => forwarder.close());

    expect(forwarder.port).not.toBe(echo.port);
    await expect(roundTrip(forwarder.port, "ping-supabase")).resolves.toBe(
      "ping-supabase",
    );
  });

  it("atende varias conexoes simultaneas", async () => {
    const echo = await startEchoServer();
    const forwarder = await startTcpForwarder(0, echo.port);
    cleanups.push(() => forwarder.close());

    const results = await Promise.all(
      ["a", "bb", "ccc", "dddd"].map((payload) =>
        roundTrip(forwarder.port, payload),
      ),
    );

    expect(results).toEqual(["a", "bb", "ccc", "dddd"]);
  });

  it("fecha a conexao do cliente sem derrubar o encaminhador quando o destino esta fora", async () => {
    const deadPort = await freePort();
    const forwarder = await startTcpForwarder(0, deadPort);
    cleanups.push(() => forwarder.close());

    await expect(connectAndWaitForClose(forwarder.port)).resolves.toBe(
      "closed",
    );

    // O encaminhador continua de pe: quando o destino sobe, passa a funcionar.
    const echo = await startEchoServer();
    const second = await startTcpForwarder(0, echo.port);
    cleanups.push(() => second.close());
    await expect(roundTrip(second.port, "ok")).resolves.toBe("ok");
  });

  it("rejeita quando a porta de escuta ja esta em uso", async () => {
    const first = await startTcpForwarder(0, 1);
    cleanups.push(() => first.close());

    await expect(startTcpForwarder(first.port, 1)).rejects.toThrow();
  });
});

describe("parsePort", () => {
  it("aceita portas validas", () => {
    expect(parsePort("55322")).toBe(55322);
    expect(parsePort("1")).toBe(1);
    expect(parsePort("65535")).toBe(65535);
  });

  it("rejeita valores ausentes, nao numericos ou fora da faixa", () => {
    expect(parsePort(undefined)).toBeNull();
    expect(parsePort("")).toBeNull();
    expect(parsePort("abc")).toBeNull();
    expect(parsePort("12ab")).toBeNull();
    expect(parsePort("0")).toBeNull();
    expect(parsePort("65536")).toBeNull();
    expect(parsePort("-5")).toBeNull();
  });
});
