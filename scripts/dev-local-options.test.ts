import { describe, expect, test } from "bun:test";
import { parseDevLocalArgs } from "./dev-local-options";

describe("parseDevLocalArgs", () => {
  test("starts no optional stacks by default", () => {
    const options = parseDevLocalArgs([]);

    expect(options.startN8n).toBe(false);
    expect(options.startEvolution).toBe(false);
    expect(options.nextArgs).toEqual([]);
    expect(options.errors).toEqual([]);
  });

  test("starts N8N when requested", () => {
    const options = parseDevLocalArgs(["n8n"]);

    expect(options.startN8n).toBe(true);
    expect(options.startEvolution).toBe(false);
    expect(options.nextArgs).toEqual([]);
    expect(options.errors).toEqual([]);
  });

  test("starts Evolution when requested", () => {
    const options = parseDevLocalArgs(["evolution"]);

    expect(options.startN8n).toBe(false);
    expect(options.startEvolution).toBe(true);
    expect(options.nextArgs).toEqual([]);
    expect(options.errors).toEqual([]);
  });

  test("starts N8N and Evolution when requested separately", () => {
    const options = parseDevLocalArgs(["n8n", "evolution"]);

    expect(options.startN8n).toBe(true);
    expect(options.startEvolution).toBe(true);
    expect(options.nextArgs).toEqual([]);
    expect(options.errors).toEqual([]);
  });

  test("starts all optional stacks with total", () => {
    const options = parseDevLocalArgs(["total"]);

    expect(options.startN8n).toBe(true);
    expect(options.startEvolution).toBe(true);
    expect(options.nextArgs).toEqual([]);
    expect(options.errors).toEqual([]);
  });

  test("forwards Next.js args", () => {
    const options = parseDevLocalArgs(["n8n", "--port", "3001"]);

    expect(options.startN8n).toBe(true);
    expect(options.startEvolution).toBe(false);
    expect(options.nextArgs).toEqual(["--port", "3001"]);
    expect(options.errors).toEqual([]);
  });

  test("consumes legacy skip flags without starting optional stacks", () => {
    const options = parseDevLocalArgs(["--skip-n8n", "--skip-evo"]);

    expect(options.startN8n).toBe(false);
    expect(options.startEvolution).toBe(false);
    expect(options.nextArgs).toEqual([]);
    expect(options.errors).toEqual([]);
  });

  test("reports conflict when N8N is both requested and skipped", () => {
    const options = parseDevLocalArgs(["n8n", "--skip-n8n"]);

    expect(options.startN8n).toBe(false);
    expect(options.startEvolution).toBe(false);
    expect(options.errors).toEqual([
      "Cannot request N8N and pass --skip-n8n at the same time.",
    ]);
  });

  test("reports conflict when Evolution is both requested and skipped", () => {
    const options = parseDevLocalArgs(["evolution", "--skip-evo"]);

    expect(options.startN8n).toBe(false);
    expect(options.startEvolution).toBe(false);
    expect(options.errors).toEqual([
      "Cannot request Evolution and pass --skip-evo at the same time.",
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
