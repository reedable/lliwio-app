import { useRef } from "react";
import type { CSSProperties } from "react";
import {
  Block,
  Fab,
  FabButton,
  FabButtons,
  Icon,
  List,
  ListItem,
  SwipeoutActions,
  SwipeoutButton,
} from "framework7-react";
import { TERTIARY } from "../domain/colors";
import store, { allColors, flattenPalette } from "../domain/store";
import type { Palette, PaletteItem } from "../domain/types";
import { createGroupId } from "../utils/ids";
import { useExpandableCard } from "../hooks/useExpandableCard";
import { useSwipeDown } from "../hooks/useSwipeDown";
import styles from "./PaletteCard.module.css";

const DEFAULT_COLOR = TERTIARY.gray;

interface PaletteCardProps {
  palette: Palette;
  expanded: boolean;
  editing: boolean;
  onExpand: () => void;
  onCollapse: () => void;
}

/** A palette's expandable card, including its editing controls and contents. */
const PaletteCard = ({ palette, expanded, editing, onExpand, onCollapse }: PaletteCardProps) => {
  const heroRef = useRef<HTMLDivElement>(null);
  const { cardRef, holderRef, contentRef, lifted, phase, style } = useExpandableCard(expanded);

  useSwipeDown(heroRef, onCollapse, {
    enabled: phase === "open",
    getScroller: () => contentRef.current,
  });

  const addColor = () => {
    const groupId = palette.groups[palette.groups.length - 1]?.id;
    if (groupId)
      store.dispatch("addColor", { paletteId: palette.id, groupId, value: DEFAULT_COLOR });
  };

  const addGroup = () => {
    store.dispatch("addGroup", {
      paletteId: palette.id,
      id: createGroupId(),
      name: `Group ${palette.groups.length + 1}`,
    });
  };

  const items: PaletteItem[] = flattenPalette(palette);
  const colors = allColors(palette);

  return (
    <>
      <div
        ref={holderRef}
        className={`${styles.pcardHolder}${lifted ? ` ${styles.isHolding}` : ""}`}
      />
      <div
        ref={cardRef}
        className={`${styles.pcard}${phase === "open" ? ` ${styles.isOpen}` : ""}${lifted ? ` ${styles.isLifted}` : ""}`}
        style={style}
        onClick={lifted ? undefined : onExpand}
      >
        <div ref={contentRef} className={styles.pcardInner}>
          <div className={styles.paletteBody}>
            <div ref={heroRef} className={styles.paletteHero}>
              <div className={styles.paletteSwatches}>
                {colors.map((color) => (
                  <div key={color.id} style={{ "--tile-color": color.value } as CSSProperties} />
                ))}
              </div>
              <input
                type="text"
                placeholder="Palette name"
                aria-label="Palette name"
                value={palette.name}
                onChange={(event) =>
                  store.dispatch("renamePalette", { id: palette.id, name: event.target.value })
                }
              />
            </div>

            <List
              strong
              inset
              dividersIos
              sortable={editing}
              sortableEnabled={editing}
              sortableMoveElements={false}
              onSortableSort={(sortData: { from: number; to: number }) =>
                store.dispatch("moveItem", {
                  paletteId: palette.id,
                  from: sortData.from,
                  to: sortData.to,
                })
              }
            >
              {items.map((item) =>
                item.kind === "group" ? (
                  <ListItem key={item.group.id} className={styles.paletteGroup}>
                    <input
                      slot="title"
                      type="text"
                      placeholder="Group name"
                      aria-label="Group name"
                      value={item.group.name}
                      onChange={(event) =>
                        store.dispatch("renameGroup", {
                          paletteId: palette.id,
                          groupId: item.group.id,
                          name: event.target.value,
                        })
                      }
                    />
                  </ListItem>
                ) : (
                  <ListItem
                    key={item.color.id}
                    swipeout={!editing}
                    title={item.color.name}
                    after={item.color.value}
                    link={editing ? undefined : `/palette/${palette.id}/color/${item.color.id}/`}
                  >
                    <div
                      slot="media"
                      className={styles.paletteChip}
                      style={{ "--tile-color": item.color.value } as CSSProperties}
                    />
                    <SwipeoutActions right>
                      <SwipeoutButton
                        close
                        color="red"
                        onClick={() =>
                          store.dispatch("removeColor", {
                            paletteId: palette.id,
                            colorId: item.color.id,
                          })
                        }
                      >
                        Delete
                      </SwipeoutButton>
                    </SwipeoutActions>
                  </ListItem>
                ),
              )}
            </List>

            {colors.length === 0 && <Block className={styles.paletteEmpty}>No colors yet.</Block>}

            <div className={styles.paletteFooter}>
              <Fab className={styles.paletteAdd} aria-label="Add">
                <Icon ios="f7:plus" md="material:add" />
                <Icon ios="f7:xmark" md="material:close" />
                <FabButtons position="top">
                  <FabButton fabClose label="Color" onClick={addColor}>
                    <Icon ios="f7:drop" md="material:water_drop" />
                  </FabButton>
                  <FabButton fabClose label="Group" onClick={addGroup}>
                    <Icon ios="f7:folder" md="material:folder" />
                  </FabButton>
                </FabButtons>
              </Fab>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PaletteCard;
