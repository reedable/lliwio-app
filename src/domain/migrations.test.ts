import { describe, expect, it } from "vitest";

import { z } from "zod";

import { readExportPayload, readPalettePayload, runLadder, step } from "./migrations";
import { SCHEMA_VERSION } from "./types";
import type { Palette } from "./types";

/*
 * One describe per stored version, plus the upgrade between them. A destructive
 * schema change adds a version block here in the same commit that adds its
 * legacy parser — the tests are what stop the ladder from becoming a story
 * about shapes that were never released.
 */

const palette = (id: string): Palette => ({
  id,
  name: `Palette ${id}`,
  ungrouped: [],
  groups: [
    {
      id: `g-${id}`,
      name: "Brand",
      colors: [{ id: `c-${id}`, name: "Red", value: "#C8102E" }],
    },
  ],
});

describe("version 1 — the current shape", () => {
  it("reads an envelope through unchanged", () => {
    const payload = { schemaVersion: 1, palettes: [palette("p1")] };
    expect(readPalettePayload(payload)).toEqual(payload);
  });

  it("reads an envelope holding no palettes", () => {
    expect(readPalettePayload({ schemaVersion: 1, palettes: [] })).toEqual({
      schemaVersion: 1,
      palettes: [],
    });
  });

  it("preserves ungrouped colours, which sit outside every group", () => {
    const withUngrouped: Palette = {
      ...palette("p1"),
      ungrouped: [{ id: "c-u", name: "Loose", value: "#012169" }],
    };
    const result = readPalettePayload({ schemaVersion: 1, palettes: [withUngrouped] });
    expect(result?.palettes[0].ungrouped).toEqual(withUngrouped.ungrouped);
  });

  it("rejects an envelope whose palette is malformed", () => {
    const bad = { schemaVersion: 1, palettes: [{ id: "p1", name: "x", groups: [] }] };
    expect(readPalettePayload(bad)).toBeNull();
  });

  it("rejects a colour missing a field, rather than salvaging the rest", () => {
    const bad = {
      schemaVersion: 1,
      palettes: [
        {
          ...palette("p1"),
          groups: [{ id: "g", name: "G", colors: [{ id: "c", name: "C" }] }],
        },
      ],
    };
    expect(readPalettePayload(bad)).toBeNull();
  });
});

describe("version 0 — before versioning existed", () => {
  it("reads a bare array, which is how palettes were stored", () => {
    expect(readPalettePayload([palette("p1")])).toEqual({
      schemaVersion: SCHEMA_VERSION,
      palettes: [palette("p1")],
    });
  });

  it("reads a bare empty array as empty, not as absent", () => {
    expect(readPalettePayload([])).toEqual({ schemaVersion: SCHEMA_VERSION, palettes: [] });
  });

  it("rejects a bare array holding a malformed palette", () => {
    expect(readPalettePayload([{ id: "p1" }])).toBeNull();
  });
});

describe("upgrade v0 -> v1", () => {
  it("only adds the envelope; palette content is untouched", () => {
    const before = [palette("p1"), palette("p2")];
    const after = readPalettePayload(structuredClone(before));
    expect(after?.palettes).toEqual(before);
  });

  it("stamps the current version, not a hardcoded 1", () => {
    expect(readPalettePayload([palette("p1")])?.schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe("a payload that carries a version it did not earn", () => {
  /*
   * The regression this guards. Import used to try the envelope, then fall back
   * to unwrapping `.palettes` unconditionally — so a file tagged with a future
   * version whose palettes still happened to match the current shape was
   * accepted and restamped as v1. Two shapes being mutually parseable is exactly
   * what the version tag exists to disambiguate.
   */
  const future = {
    format: "lliwio-app/palettes",
    exportedAt: "2026-08-23T00:00:00.000Z",
    schemaVersion: SCHEMA_VERSION + 1,
    palettes: [palette("p1")],
  };

  it("refuses a future version on import even when the palettes parse", () => {
    expect(readExportPayload(future)).toBeNull();
  });

  it("refuses a future version from storage", () => {
    expect(
      readPalettePayload({ schemaVersion: SCHEMA_VERSION + 1, palettes: [palette("p1")] }),
    ).toBeNull();
  });

  it("never reads a tagged payload with an untagged parser", () => {
    // Tagged, unknown version, but shaped so the v0 parser would accept the
    // inner array if it were ever offered it.
    expect(readExportPayload({ schemaVersion: 99, palettes: [] })).toBeNull();
  });
});

describe("import files", () => {
  it("reads a current export, ignoring format and exportedAt", () => {
    const file = {
      format: "lliwio-app/palettes",
      exportedAt: "2026-08-23T00:00:00.000Z",
      schemaVersion: SCHEMA_VERSION,
      palettes: [palette("p1")],
    };
    expect(readExportPayload(file)).toEqual({
      schemaVersion: SCHEMA_VERSION,
      palettes: [palette("p1")],
    });
  });

  it("upgrades a pre-versioning export, which had no schemaVersion anywhere", () => {
    const file = {
      format: "lliwio-app/palettes",
      exportedAt: "2026-08-23T00:00:00.000Z",
      palettes: [palette("p1")],
    };
    expect(readExportPayload(file)).toEqual({
      schemaVersion: SCHEMA_VERSION,
      palettes: [palette("p1")],
    });
  });

  it("rejects an export whose palettes are malformed", () => {
    const file = { format: "lliwio-app/palettes", palettes: [{ id: "p1" }] };
    expect(readExportPayload(file)).toBeNull();
  });

  it.each([
    ["an array", [palette("p1")]],
    ["a string", "palettes"],
    ["null", null],
  ])("rejects %s, which is not an export envelope", (_label, value) => {
    expect(readExportPayload(value)).toBeNull();
  });
});

describe("the ladder runner, against a synthetic three-version ladder", () => {
  /*
   * What the real ladder cannot demonstrate yet: that upgrades chain. Version 7
   * is untagged (like our v0), 8 and 9 are tagged. Each upgrade does something
   * observable so a skipped step is visible in the output.
   */
  const v7 = z.array(z.string());
  const v8 = z.object({ schemaVersion: z.literal(8), items: z.array(z.string()) });
  const v9 = z.object({
    schemaVersion: z.literal(9),
    items: z.array(z.string()),
    seenSteps: z.array(z.string()),
  });

  const ladder = [
    step(0, v7, (data: string[]) => ({ schemaVersion: 8, items: data })),
    step(8, v8, (data: z.infer<typeof v8>) => ({
      schemaVersion: 9,
      items: data.items,
      seenSteps: ["8->9"],
    })),
    step(9, v9, null),
  ];

  it("walks every step from the oldest version to current", () => {
    expect(runLadder(ladder, ["a", "b"])).toEqual({
      schemaVersion: 9,
      items: ["a", "b"],
      seenSteps: ["8->9"],
    });
  });

  it("starts partway up when the payload is already an intermediate version", () => {
    expect(runLadder(ladder, { schemaVersion: 8, items: ["a"] })).toEqual({
      schemaVersion: 9,
      items: ["a"],
      seenSteps: ["8->9"],
    });
  });

  it("passes the current version through without upgrading", () => {
    const current = { schemaVersion: 9, items: ["a"], seenSteps: [] };
    expect(runLadder(ladder, current)).toEqual(current);
  });

  it("refuses a version between two known ones rather than guessing", () => {
    expect(runLadder(ladder, { schemaVersion: 8.5, items: ["a"] })).toBeNull();
  });

  it("returns null when an upgrade produces something the final schema rejects", () => {
    const broken = [
      step(0, v7, () => ({ schemaVersion: 9, items: "not an array", seenSteps: [] })),
      step(9, v9, null),
    ];
    expect(runLadder(broken, ["a"])).toBeNull();
  });
});

describe("unreadable input", () => {
  it.each([
    ["a future version", { schemaVersion: SCHEMA_VERSION + 1, palettes: [] }],
    ["a version that is a string", { schemaVersion: "1", palettes: [] }],
    ["an envelope with no palettes key", { schemaVersion: 1 }],
    ["an unrelated object", { nope: true }],
    ["a string", "palettes"],
    ["null", null],
    ["undefined", undefined],
  ])("returns null for %s", (_label, value) => {
    expect(readPalettePayload(value)).toBeNull();
  });
});
