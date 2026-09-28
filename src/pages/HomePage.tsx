import { useEffect, useId, useState } from "react";
import { Link, Page, Popover, f7, useStore } from "framework7-react";
import store from "../domain/store";
import type { Palette } from "../domain/types";
import { createPaletteId } from "../utils/ids";
import PaletteCard from "./PaletteCard";
import styles from "./HomePage.module.css";

const HomePage = () => {
  const palettes = useStore("palettes") as Palette[];
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [menuOpened, setMenuOpened] = useState(false);
  const menuButtonId = useId();
  const expanded = palettes.find((palette) => palette.id === expandedId) ?? null;

  const collapse = () => {
    setMenuOpened(false);
    setExpandedId(null);
    setEditing(false);
  };

  const deletePalette = () => {
    if (!expanded) return;
    const palette = expanded;
    setMenuOpened(false);
    f7.dialog.confirm(`Delete “${palette.name}”? This cannot be undone.`, "Delete palette", () => {
      collapse();
      store.dispatch("deletePalette", { id: palette.id });
    });
  };

  const addPalette = () => {
    const id = createPaletteId();
    store.dispatch("addPalette", { id });
    setExpandedId(id);
  };

  // The tab bar belongs to home and settings, not an expanded palette card.
  useEffect(() => {
    document.documentElement.classList.toggle("pcard-open", expanded !== null);
    return () => document.documentElement.classList.remove("pcard-open");
  }, [expanded]);

  return (
    <Page name="home" noNavbar className={styles.page}>
      <div slot="fixed" className={styles.controls}>
        <Link
          href={false}
          onClick={collapse}
          aria-label="Back"
          className={`${styles.control} ${styles.controlBack}`}
          iconIos="f7:chevron_left"
          iconMd="material:chevron_left"
        />
        <Link
          className={`${styles.control} ${styles.controlAdd}`}
          iconIos="f7:plus"
          iconMd="material:add"
          aria-label="Add palette"
          onClick={addPalette}
        />
        <Link
          id={menuButtonId}
          className={`${styles.control} ${styles.controlEdit}`}
          href={false}
          aria-label={editing ? "Done editing" : "Palette options"}
          aria-haspopup={editing ? undefined : "dialog"}
          aria-expanded={menuOpened}
          iconIos={editing ? undefined : "f7:ellipsis"}
          iconMd={editing ? undefined : "material:more_horiz"}
          onClick={() => (editing ? setEditing(false) : setMenuOpened(true))}
        >
          {editing ? "Done" : null}
        </Link>
      </div>

      <Popover
        className={styles.paletteMenu}
        opened={menuOpened && expanded !== null}
        targetEl={`[id="${menuButtonId}"]`}
        closeByOutsideClick
        closeOnEscape
        onPopoverClosed={() => setMenuOpened(false)}
      >
        <div className={styles.menuActions}>
          <button
            type="button"
            className={styles.menuAction}
            onClick={() => {
              setMenuOpened(false);
              setEditing(true);
            }}
          >
            <span className="f7-icons" aria-hidden="true">
              pencil
            </span>
            <span>Edit</span>
          </button>
          <button
            type="button"
            className={`${styles.menuAction} ${styles.menuDelete}`}
            onClick={deletePalette}
          >
            <span className="f7-icons" aria-hidden="true">
              trash
            </span>
            <span>Delete Palette</span>
          </button>
        </div>
      </Popover>

      <h1 className={styles.homeTitle}>lliwio-app</h1>

      {palettes.map((palette) => (
        <PaletteCard
          key={palette.id}
          palette={palette}
          expanded={palette.id === expandedId}
          editing={editing && palette.id === expandedId}
          onExpand={() => setExpandedId(palette.id)}
          onCollapse={collapse}
        />
      ))}
    </Page>
  );
};

export default HomePage;
