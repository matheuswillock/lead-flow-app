import { describe, expect, it } from "bun:test";
import { assertPublicBethaniaSenderHost, isPublicBethaniaSenderAddress } from "./BethaniaSenderUrlPolicy";

describe("Bethânia sender URL SSRF policy", () => {
  it("blocks private, loopback, link-local, reserved, and documentation IP ranges", () => {
    for (const address of [
      "0.1.2.3", "10.0.0.1", "100.64.0.1", "127.0.0.1", "169.254.1.2",
      "172.16.0.1", "192.168.1.1", "198.18.0.1", "203.0.113.10",
      "::", "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1", "ff02::1", "2001:db8::1",
    ]) {
      expect(isPublicBethaniaSenderAddress(address)).toBe(false);
    }
  });

  it("accepts globally routable IPv4 and IPv6 addresses", () => {
    expect(isPublicBethaniaSenderAddress("8.8.8.8")).toBe(true);
    expect(isPublicBethaniaSenderAddress("2606:4700:4700::1111")).toBe(true);
  });

  it("rejects a production sender hostname when any DNS result is non-public", async () => {
    await expect(assertPublicBethaniaSenderHost(
      "https://sender.example.com/",
      async () => [
        { address: "8.8.8.8", family: 4 },
        { address: "10.0.0.8", family: 4 },
      ],
      "production",
    )).rejects.toThrow("URL do conector não permitida");
  });

  it("allows only public DNS results for production hostnames", async () => {
    await expect(assertPublicBethaniaSenderHost(
      "https://sender.example.com/",
      async () => [{ address: "8.8.8.8", family: 4 }],
      "production",
    )).resolves.toBeUndefined();
  });
});
