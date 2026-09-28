import { createStore } from "framework7/lite";
import { z } from "zod";

import { TERTIARY } from "./colors";
import { createColorId, createGroupId } from "../utils/ids";
import { DEFAULT_GROUP_NAME, SEED_PALETTES } from "./seed";
import { readExportPayload, readPalettePayload } from "./migrations";
import { SCHEMA_VERSION, SettingsSchema } from "./types";
import type {
  ColorGroup,
  Palette,
  PaletteColor,
  PaletteItem,
  Settings,
  StoredPalettes,
} from "./types";

export const flattenPalette = (palette: Palette): PaletteItem[] => [
  ...palette.ungrouped.map((color): PaletteItem => ({ kind: "color", color })),
  ...palette.groups.flatMap((group): PaletteItem[] => [
    { kind: "group", group },
    ...group.colors.map((color): PaletteItem => ({ kind: "color", color })),
  ]),
];

/** Walks the flat order back into groups: each header opens one, colours fill it. */
const rebuildPalette = (items: PaletteItem[]): Pick<Palette, "ungrouped" | "groups"> => {
  const ungrouped: PaletteColor[] = [];
  const groups: ColorGroup[] = [];
  items.forEach((item) => {
    if (item.kind === "group") {
      groups.push({ ...item.group, colors: [] });
    } else if (groups.length === 0) {
      ungrouped.push(item.color);
    } else {
      groups[groups.length - 1].colors.push(item.color);
    }
  });
  return { ungrouped, groups };
};

/** Flattened view for callers that need every colour in order. */
export const allColors = (palette: Palette): PaletteColor[] => [
  ...palette.ungrouped,
  ...palette.groups.flatMap((g) => g.colors),
];

export const findColor = (palette: Palette, colorId: string): PaletteColor | undefined =>
  allColors(palette).find((c) => c.id === colorId);

interface AppState {
  palettes: Palette[];
  settings: Settings;
}

const SETTINGS_KEY = "lliw.settings";
const PALETTES_KEY = "lliw.palettes";

const DEFAULT_SETTINGS: Settings = {
  defaultConformance: "AAA",
  showBaseColors: true,
  theme: "auto",
};

/*
 * Anything that is not exactly a Settings object falls back to the defaults
 * whole. An unrecognised conformance level would otherwise reach the colour page
 * as a filter with no MIN_RATIO entry.
 */
const loadSettings = (): Settings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = SettingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
  } catch {
    // Unreadable or unparseable storage should not stop the app booting.
    return DEFAULT_SETTINGS;
  }
};

const saveSettings = (settings: Settings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable or full; the in-memory state is still correct.
  }
};

/*
 * Written as an envelope so the payload carries its own version. Reading goes
 * through migrations.readPalettePayload, which accepts the current shape or any
 * retired one and upgrades it — a bare array written before versioning existed
 * is still read here, not discarded.
 *
 * Anything matching no known version is rejected whole and the seeds stand in.
 * An empty palettes array is valid and honoured as empty; the seeds are a
 * first-run value, not a floor.
 */
const loadPalettes = (): Palette[] => {
  try {
    const raw = localStorage.getItem(PALETTES_KEY);
    if (raw === null) return SEED_PALETTES;
    return readPalettePayload(JSON.parse(raw))?.palettes ?? SEED_PALETTES;
  } catch {
    return SEED_PALETTES;
  }
};

const savePalettes = (palettes: Palette[]) => {
  try {
    const payload: StoredPalettes = { schemaVersion: SCHEMA_VERSION, palettes };
    localStorage.setItem(PALETTES_KEY, JSON.stringify(payload));
  } catch {
    // Storage can be unavailable or full; the in-memory state is still correct.
  }
};

/*
 * Transfer format. `format` lets a stray JSON file be rejected as "not ours"
 * rather than "corrupt"; `schemaVersion` inside the payload is what lets an
 * older file be recognised and upgraded rather than misread.
 */
const EXPORT_FORMAT = "lliwio-app/palettes";

interface PaletteExport {
  format: typeof EXPORT_FORMAT;
  exportedAt: string;
  schemaVersion: number;
  palettes: Palette[];
}

type ImportResult = { ok: true; palettes: Palette[] } | { ok: false; reason: string };

export const buildExport = (palettes: Palette[]): PaletteExport => ({
  format: EXPORT_FORMAT,
  exportedAt: new Date().toISOString(),
  schemaVersion: SCHEMA_VERSION,
  palettes,
});

export const parseImport = (text: string): ImportResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "That file is not valid JSON." };
  }

  /*
   * Two steps only so the two failures read differently to the user: a file that
   * is not ours at all, versus one that is ours and malformed. The schema is the
   * authority in both cases.
   */
  if (!z.object({ format: z.literal(EXPORT_FORMAT) }).safeParse(parsed).success) {
    return { ok: false, reason: "That file was not exported from lliwio-app." };
  }
  /*
   * Same ladder as stored data: an export written before versioning existed is
   * upgraded, and one carrying a version this build does not know is refused
   * rather than guessed at.
   */
  const payload = readExportPayload(parsed);
  if (payload === null) {
    return { ok: false, reason: "That file is a lliwio-app export, but it could not be read." };
  }
  return { ok: true, palettes: payload.palettes };
};

interface StoreCtx {
  state: AppState;
}

/** Applies `fn` to one palette's groups and persists. */
const updateGroups = (
  state: AppState,
  paletteId: string,
  fn: (groups: ColorGroup[]) => ColorGroup[],
) => {
  state.palettes = state.palettes.map((p) =>
    p.id === paletteId ? { ...p, groups: fn(p.groups) } : p,
  );
  savePalettes(state.palettes);
};

/** Applies `fn` to every colour list, ungrouped included — for edits by colour id. */
const mapAllColors = (
  state: AppState,
  paletteId: string,
  fn: (colors: PaletteColor[]) => PaletteColor[],
) => {
  state.palettes = state.palettes.map((p) =>
    p.id === paletteId
      ? {
          ...p,
          ungrouped: fn(p.ungrouped),
          groups: p.groups.map((g) => ({ ...g, colors: fn(g.colors) })),
        }
      : p,
  );
  savePalettes(state.palettes);
};

const store = createStore({
  state: {
    palettes: loadPalettes(),
    settings: loadSettings(),
  } as AppState,
  getters: {
    palettes({ state }: StoreCtx) {
      return state.palettes;
    },
    settings({ state }: StoreCtx) {
      return state.settings;
    },
  },
  actions: {
    setSettings({ state }: StoreCtx, patch: Partial<Settings>) {
      state.settings = { ...state.settings, ...patch };
      saveSettings(state.settings);
    },
    /*
     * Merge, incoming wins on id collision. Existing palettes keep their position
     * so an import does not reshuffle the list; genuinely new ones are appended.
     */
    importPalettes({ state }: StoreCtx, { palettes }: { palettes: Palette[] }) {
      const incoming = new Map(palettes.map((p) => [p.id, p]));
      const existingIds = new Set(state.palettes.map((p) => p.id));
      const merged = state.palettes.map((p) => incoming.get(p.id) ?? p);
      const added = palettes.filter((p) => !existingIds.has(p.id));
      state.palettes = [...merged, ...added];
      savePalettes(state.palettes);
    },
    deletePalette({ state }: StoreCtx, { id }: { id: string }) {
      state.palettes = state.palettes.filter((p) => p.id !== id);
      savePalettes(state.palettes);
    },
    addPalette({ state }: StoreCtx, { id }: { id: string }) {
      const newPalette: Palette = {
        id,
        name: "Untitled",
        ungrouped: [],
        groups: [
          {
            id: createGroupId(),
            name: DEFAULT_GROUP_NAME,
            colors: [{ id: createColorId(), name: "Color 1", value: TERTIARY.gray }],
          },
        ],
      };
      state.palettes = [newPalette, ...state.palettes];
      savePalettes(state.palettes);
    },
    renamePalette({ state }: StoreCtx, { id, name }: { id: string; name: string }) {
      state.palettes = state.palettes.map((p) => (p.id === id ? { ...p, name } : p));
      savePalettes(state.palettes);
    },
    addGroup(
      { state }: StoreCtx,
      { paletteId, id, name }: { paletteId: string; id: string; name: string },
    ) {
      updateGroups(state, paletteId, (groups) => [...groups, { id, name, colors: [] }]);
    },
    renameGroup(
      { state }: StoreCtx,
      { paletteId, groupId, name }: { paletteId: string; groupId: string; name: string },
    ) {
      updateGroups(state, paletteId, (groups) =>
        groups.map((g) => (g.id === groupId ? { ...g, name } : g)),
      );
    },
    /* Colours go with the group; deleting is the only way to remove them wholesale. */
    removeGroup(
      { state }: StoreCtx,
      { paletteId, groupId }: { paletteId: string; groupId: string },
    ) {
      updateGroups(state, paletteId, (groups) => groups.filter((g) => g.id !== groupId));
    },
    /* Appends to a named group. Numbering counts the whole palette, so names stay
       unique across groups rather than restarting at 1 in each. */
    addColor(
      { state }: StoreCtx,
      { paletteId, groupId, value }: { paletteId: string; groupId: string; value: string },
    ) {
      updateGroups(state, paletteId, (groups) => {
        const total = groups.reduce((n, g) => n + g.colors.length, 0);
        return groups.map((g) =>
          g.id === groupId
            ? {
                ...g,
                colors: [...g.colors, { id: createColorId(), name: `Color ${total + 1}`, value }],
              }
            : g,
        );
      });
    },
    setColorValue(
      { state }: StoreCtx,
      { paletteId, colorId, value }: { paletteId: string; colorId: string; value: string },
    ) {
      mapAllColors(state, paletteId, (colors) =>
        colors.map((c) => (c.id === colorId ? { ...c, value } : c)),
      );
    },
    renameColor(
      { state }: StoreCtx,
      { paletteId, colorId, name }: { paletteId: string; colorId: string; name: string },
    ) {
      mapAllColors(state, paletteId, (colors) =>
        colors.map((c) => (c.id === colorId ? { ...c, name } : c)),
      );
    },
    removeColor(
      { state }: StoreCtx,
      { paletteId, colorId }: { paletteId: string; colorId: string },
    ) {
      mapAllColors(state, paletteId, (colors) => colors.filter((c) => c.id !== colorId));
    },
    /*
     * from/to are positions in the flat rendered sequence — headers and colours as
     * siblings in one list, which is what makes Framework7's sibling-scoped indices
     * meaningful across groups. The move is applied to that sequence and folded
     * back, so a colour dragged past a header changes group and a dragged header
     * repositions alone, leaving its colours to join whatever now precedes them.
     */
    moveItem(
      { state }: StoreCtx,
      { paletteId, from, to }: { paletteId: string; from: number; to: number },
    ) {
      state.palettes = state.palettes.map((p) => {
        if (p.id !== paletteId) return p;
        const items = flattenPalette(p);
        if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
          return p;
        }
        const next = [...items];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return { ...p, ...rebuildPalette(next) };
      });
      savePalettes(state.palettes);
    },
  },
});
export default store;
