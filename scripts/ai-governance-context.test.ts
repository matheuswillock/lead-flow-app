import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  countContextWords,
  isAlwaysOnInstruction,
  validateContextWordBudget,
  writeGovernanceAdapterIfChanged,
} from "./ai-governance";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("AI context budgets", () => {
  test("counts normalized whitespace-separated words", () => {
    expect(countContextWords("  one\n\ntwo   three  ")).toBe(3);
    expect(countContextWords("   ")).toBe(0);
  });

  test("recognizes quoted and unquoted always-on instructions", () => {
    expect(isAlwaysOnInstruction("---\napplyTo: '**'\n---")).toBe(true);
    expect(isAlwaysOnInstruction('---\napplyTo: "**"\n---')).toBe(true);
    expect(isAlwaysOnInstruction("---\napplyTo: app/**\n---")).toBe(false);
  });

  test("reports a budget violation with measured values", () => {
    const issues: string[] = [];

    const words = validateContextWordBudget(
      "fixture.md",
      "one two three",
      2,
      issues,
    );

    expect(words).toBe(3);
    expect(issues).toEqual([
      "Context budget exceeded (fixture.md): 3 words, maximum 2.",
    ]);
  });

  test("accepts content at the exact limit", () => {
    const issues: string[] = [];

    validateContextWordBudget("fixture.md", "one two", 2, issues);

    expect(issues).toEqual([]);
  });

  test("does not rewrite an unchanged governance adapter", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "governance-sync-"),
    );
    temporaryDirectories.push(directory);
    const target = path.join(directory, "AGENTS.md");

    expect(
      await writeGovernanceAdapterIfChanged(target, "same\n", "fixture"),
    ).toBe(true);
    expect(
      await writeGovernanceAdapterIfChanged(target, "same\n", "fixture"),
    ).toBe(false);
    expect(await readFile(target, "utf8")).toBe("same\n");
  });
});
