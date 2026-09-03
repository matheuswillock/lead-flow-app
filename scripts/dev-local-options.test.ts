import { describe, expect, test } from "bun:test";
import { parseDevLocalArgs } from "./dev-local-options";

describe("parseDevLocalArgs", () => {
  test("parses an empty argv without errors", () => {
    const options = parseDevLocalArgs([]);

    expect(options.nextArgs).toEqual([]);
    expect(options.errors).toEqual([]);
  });

  test("forwards Next.js args", () => {
    const options = parseDevLocalArgs(["--port", "3001"]);

    expect(options.nextArgs).toEqual(["--port", "3001"]);
    expect(options.errors).toEqual([]);
  });

  test.each([["n8n"], ["evolution"], ["total"], ["--skip-n8n"], ["--skip-evo"]])(
    "rejects the removed stack option %s instead of forwarding it to Next",
    (removedArg) => {
      const options = parseDevLocalArgs([removedArg]);

      expect(options.nextArgs).toEqual([]);
      expect(options.errors).toEqual([
        `As stacks locais de N8N/Evolution foram removidas — opção não existe mais: ${removedArg}`,
      ]);
    }
  );

  test("lists every removed stack option in a single error", () => {
    const options = parseDevLocalArgs(["n8n", "evolution", "--port", "3001"]);

    expect(options.nextArgs).toEqual(["--port", "3001"]);
    expect(options.errors).toEqual([
      "As stacks locais de N8N/Evolution foram removidas — opção não existe mais: n8n, evolution",
    ]);
  });

  test("defaults to db-only (fullSupabase false, clone false)", () => {
    const options = parseDevLocalArgs([]);

    expect(options.fullSupabase).toBe(false);
    expect(options.stackMode).toBe("db-only");
    expect(options.clone).toBe(false);
    expect(options.skipClone).toBe(false);
  });

  test("enables hybrid stack with --hybrid", () => {
    const options = parseDevLocalArgs(["--hybrid"]);

    expect(options.stackMode).toBe("hybrid");
    expect(options.fullSupabase).toBe(false);
    expect(options.nextArgs).toEqual([]);
    expect(options.errors).toEqual([]);
  });

  test("--db-only is idempotent with the default", () => {
    const options = parseDevLocalArgs(["--db-only"]);

    expect(options.stackMode).toBe("db-only");
    expect(options.errors).toEqual([]);
  });

  test("reports conflict when --hybrid and --db-only are both passed", () => {
    const options = parseDevLocalArgs(["--hybrid", "--db-only"]);

    expect(options.errors).toEqual(["Cannot pass --hybrid and --db-only at the same time."]);
  });

  test("reports conflict when --hybrid and --full-supabase are both passed", () => {
    const options = parseDevLocalArgs(["--hybrid", "--full-supabase"]);

    expect(options.errors).toEqual(["Cannot pass --hybrid and --full-supabase at the same time."]);
  });

  test("enables clone with --clone", () => {
    const options = parseDevLocalArgs(["--clone"]);

    expect(options.clone).toBe(true);
    expect(options.skipClone).toBe(false);
    expect(options.errors).toEqual([]);
  });

  test("reports conflict when --clone and --skip-clone are both passed", () => {
    const options = parseDevLocalArgs(["--clone", "--skip-clone"]);

    expect(options.errors).toEqual(["Cannot pass --clone and --skip-clone at the same time."]);
  });

  test("enables full Supabase stack with --full-supabase", () => {
    const options = parseDevLocalArgs(["--full-supabase"]);

    expect(options.fullSupabase).toBe(true);
    expect(options.stackMode).toBe("db-only");
    expect(options.nextArgs).toEqual([]);
    expect(options.errors).toEqual([]);
  });
});
