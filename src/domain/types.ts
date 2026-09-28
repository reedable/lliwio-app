import { z } from "zod";

import * as current from "./schema/v1";

/*
 * The app's view of the data. Everything versioned is re-exported from
 * schema/<current>.ts; everything unversioned is defined here.
 *
 * Schemas are the source of truth and the types are inferred from them, so a
 * runtime check and a static type cannot drift apart. That is what was missing
 * when a comment was allowed to assert the shape instead.
 *
 * CHANGE POLICY, as of 1.1.0:
 *
 *   Additive changes are fine, and are made in place in the current schema
 *   file. A new optional field, a new schema, a widened union — anything that
 *   leaves data written by an older build still parsing.
 *
 *   Destructive changes require a major version bump. Removing a field,
 *   renaming one, narrowing a type or an enum, making an optional field
 *   required — anything that makes older data fail to parse.
 *
 * Reading is strict: `loadPalettes` and `loadSettings` reject a non-conforming
 * value whole rather than salvaging part of it, because lliwio-app is reading data
 * lliwio-app wrote. That is what makes the distinction above load-bearing — under
 * a destructive change, existing data does not degrade, it disappears.
 *
 * So a destructive change ships as a new schema file plus one upgrade step:
 *
 *   1. cp src/domain/schema/v1.ts src/domain/schema/v2.ts, and edit v2.ts.
 *   2. Point the `current` import above at v2.
 *   3. Add the v1 -> v2 upgrade and append the entry in migrations.ts.
 *
 * No file is ever "frozen" as an action — each schema file is already frozen
 * the day it is written, and is left untouched when it stops being current.
 * `diff schema/v1.ts schema/v2.ts` is then the specification for the upgrade.
 *
 * The rule that keeps the ladder honest: a version is only added in the same
 * commit that ships the break it covers. Never speculatively, for a shape that
 * never existed.
 *
 * Only palettes are versioned. Settings are not: losing three preferences is a
 * reset, not a loss, so they parse strictly and fall back to defaults.
 */

export const SCHEMA_VERSION = current.SCHEMA_VERSION;

export const PaletteColorSchema = current.PaletteColorSchema;
export const ColorGroupSchema = current.ColorGroupSchema;
export const PaletteSchema = current.PaletteSchema;
export const StoredPalettesSchema = current.StoredPalettesSchema;

export type PaletteColor = current.PaletteColor;
export type ColorGroup = current.ColorGroup;
export type Palette = current.Palette;
export type StoredPalettes = current.StoredPalettes;

export const CONFORMANCE_LEVELS = ["AAA", "AA", "A"] as const;
export const THEMES = ["auto", "ios", "md"] as const;

/** The conformance tab the colour page opens on. */
export const ConformanceSettingSchema = z.enum(CONFORMANCE_LEVELS);

/*
 * Which Framework7 theme to render. 'auto' hands the decision back to F7, which
 * resolves it as `device.ios ? 'ios' : 'md'` — and its iPad detection matches
 * window.screen against a hardcoded list of resolutions, because iPadOS reports
 * platform 'MacIntel'. An iPad whose screen is not on that list gets Material
 * Design. This setting exists so that guess can be overridden.
 */
export const ThemeSettingSchema = z.enum(THEMES);

export const SettingsSchema = z.object({
  defaultConformance: ConformanceSettingSchema,
  showBaseColors: z.boolean(),
  theme: ThemeSettingSchema,
});

export type ConformanceSetting = z.infer<typeof ConformanceSettingSchema>;
export type ThemeSetting = z.infer<typeof ThemeSettingSchema>;
export type Settings = z.infer<typeof SettingsSchema>;

/*
 * Not a schema: this is a render-time view, built by flattenPalette and consumed
 * by the card. It is never parsed from stored or imported data, so there is
 * nothing to validate.
 *
 * The card renders one flat list whose rows are headers and colours as siblings,
 * so Framework7's sortable — whose indices are sibling-scoped — can move a colour
 * across groups and reposition a header. The flat form is derived for render and
 * for interpreting a drop; it is never stored. The folds live in store.ts.
 */
export type PaletteItem =
  | { kind: "color"; color: PaletteColor }
  | { kind: "group"; group: ColorGroup };
