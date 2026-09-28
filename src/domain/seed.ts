import { BRAND, SECONDARY } from "./colors";
import { createColorId, createGroupId } from "../utils/ids";
import type { ColorGroup, Palette, PaletteColor } from "./types";

/** The group migrated colours land in; every palette has at least this one. */
export const DEFAULT_GROUP_NAME = "Colors";

const seedColors = (values: string[]): PaletteColor[] =>
  values.map((value, i) => ({ id: createColorId(), name: `Color ${i + 1}`, value }));

const seedGroup = (values: string[]): ColorGroup[] => [
  { id: createGroupId(), name: DEFAULT_GROUP_NAME, colors: seedColors(values) },
];

/*
 * For palettes whose colours have real names rather than generated ones. The key
 * carries the name, so colors.ts stays the single source of truth for both the
 * value and what it is called.
 */
const namedGroup = (name: string, colors: Readonly<Record<string, string>>): ColorGroup => ({
  id: createGroupId(),
  name,
  colors: Object.entries(colors).map(([key, value]) => ({
    id: createColorId(),
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value,
  })),
});

/** Used only when storage has never been written — not when it holds an empty list. */
export const SEED_PALETTES: Palette[] = [
  {
    id: "p1",
    name: "lliwio-app",
    ungrouped: [],
    groups: [namedGroup("Brand", BRAND), namedGroup("Secondary", SECONDARY)],
  },
  {
    id: "p2",
    name: "Citrus",
    ungrouped: [],
    groups: seedGroup(["#fec89a", "#ffd7ba", "#fec5bb", "#f8edeb", "#d8e2dc"]),
  },
  {
    id: "p3",
    name: "Forest",
    ungrouped: [],
    groups: seedGroup(["#264653", "#2a9d8f", "#e9c46a", "#f4a261", "#e76f51"]),
  },
];
