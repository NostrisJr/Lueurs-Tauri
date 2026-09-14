import clsx from "clsx";
import { useAtom } from "jotai";
import { Squircle } from "../../../shared/components/Squircle";
import { useSpacesEditor } from "../../../shared/hooks/useSpacesEditor";
import { spaceSwitcherAlwaysVisibleAtom } from "../../../shared/lib/atoms";
import { ALL_SPACE_ID, type VaultSpace } from "../../../shared/lib/vaultConfig";
import {
  type ReorderState,
  useMobileReorder,
} from "../../hooks/useMobileReorder";
import { hapticImpact } from "../../lib/haptics";
import { MobileEmojiField } from "./MobileEmojiField";

const DRAG_HANDLE = (
  <svg
    width="10"
    height="16"
    viewBox="0 0 10 16"
    fill="currentColor"
    aria-hidden="true"
  >
    <circle cx="2.5" cy="3" r="1.3" />
    <circle cx="7.5" cy="3" r="1.3" />
    <circle cx="2.5" cy="8" r="1.3" />
    <circle cx="7.5" cy="8" r="1.3" />
    <circle cx="2.5" cy="13" r="1.3" />
    <circle cx="7.5" cy="13" r="1.3" />
  </svg>
);

function DragHandle({
  id,
  reorder,
}: {
  id: string;
  reorder: ReorderState;
}) {
  return (
    // Zone de préhension élargie par du padding compensé en marge négative : la
    // poignée reste visuellement fine mais reste attrapable au doigt.
    <button
      type="button"
      {...reorder.handleProps(id)}
      aria-label="Réordonner l'espace"
      className={clsx("shrink-0 px-2 -mx-1 py-2 -my-2", "text-ink-5")}
    >
      {DRAG_HANDLE}
    </button>
  );
}

// Ligne "Tout" — non supprimable, non renommable, icône modifiable
function ToutRow({
  icon,
  onIconChange,
  isLast,
  reorder,
}: {
  icon?: string;
  onIconChange: (icon: string) => void;
  isLast: boolean;
  reorder: ReorderState;
}) {
  return (
    <div
      ref={(el) => reorder.registerRow(ALL_SPACE_ID, el)}
      style={reorder.rowStyle(ALL_SPACE_ID)}
      className={clsx(
        "flex items-center gap-2 px-3 py-3 bg-surface",
        isLast ? "" : "border-b border-line"
      )}
    >
      <DragHandle id={ALL_SPACE_ID} reorder={reorder} />
      <MobileEmojiField value={icon} onChange={onIconChange} />
      {/* Espacement équivalent au champ couleur */}
      <div className="w-9 shrink-0" />
      <span
        className={clsx(
          "flex-1 text-base px-2.5 py-2 select-none",
          "text-ink-4"
        )}
      >
        Tout
      </span>
      {/* Espacement équivalent au × */}
      <div className="w-8 shrink-0" />
    </div>
  );
}

interface RowProps {
  space: VaultSpace;
  index: number;
  onNameChange: (index: number, name: string) => void;
  onNameFocus: (index: number) => void;
  onNameBlur: (index: number) => void;
  onIconChange: (index: number, icon: string) => void;
  onColorChange: (index: number, color: string) => void;
  onDelete: (index: number) => void;
  isLast: boolean;
  reorder: ReorderState;
}

function SpaceRow({
  space,
  index,
  onNameChange,
  onNameFocus,
  onNameBlur,
  onIconChange,
  onColorChange,
  onDelete,
  isLast,
  reorder,
}: RowProps) {
  return (
    <div
      ref={(el) => reorder.registerRow(space.id, el)}
      style={reorder.rowStyle(space.id)}
      className={clsx(
        "flex items-center gap-2 px-3 py-3 bg-surface",
        isLast ? "" : "border-b border-line"
      )}
    >
      <DragHandle id={space.id} reorder={reorder} />

      <MobileEmojiField
        value={space.icon}
        onChange={(icon) => onIconChange(index, icon)}
      />

      <label
        className="relative shrink-0 cursor-pointer"
        aria-label="Couleur de l'espace"
      >
        <span
          className={clsx(
            "block w-9 h-9 rounded-lg border-2 shadow ring-1",
            "border-surface ring-line-2"
          )}
          style={{
            background: space.color
              ? `linear-gradient(135deg, ${space.color}, ${space.color}99)`
              : "linear-gradient(135deg, var(--color-surface-4), var(--color-surface-5))",
          }}
        />
        <input
          type="color"
          // <input type="color"> n'accepte qu'un littéral #rrggbb, et cette
          // valeur est une donnée choisie par l'utilisateur, pas une couleur
          // de thème : elle ne doit pas basculer en sombre.
          value={space.color ?? "#6366f1"} // theme-ok
          onChange={(e) => onColorChange(index, e.target.value)}
          className="absolute inset-0 opacity-0 w-full h-full"
        />
      </label>

      <input
        type="text"
        value={space.name}
        onChange={(e) => onNameChange(index, e.target.value)}
        onFocus={() => onNameFocus(index)}
        onBlur={() => onNameBlur(index)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        autoCorrect="off"
        autoCapitalize="off"
        className={clsx(
          "flex-1 min-w-0 text-base border rounded-lg px-2.5 py-2 outline-none",
          "border-line-2",
          "focus:border-line-3"
        )}
        placeholder="Nom de l'espace"
        aria-label="Nom de l'espace"
      />

      <button
        type="button"
        onClick={() => {
          hapticImpact("medium");
          onDelete(index);
        }}
        className={clsx(
          "shrink-0 transition-colors text-2xl leading-none px-1",
          "text-ink-4",
          "active:text-danger"
        )}
        aria-label="Supprimer l'espace"
      >
        ×
      </button>
    </div>
  );
}

export function MobileEspacesSection() {
  const {
    spaces,
    orderedEntries,
    canEdit,
    toutIcon,
    addSpace,
    beginRename,
    setName,
    dedupeName,
    setIcon,
    setColor,
    setToutIcon,
    reorder: commitReorder,
    deleteSpace,
  } = useSpacesEditor();
  const [switcherAlwaysVisible, setSwitcherAlwaysVisible] = useAtom(
    spaceSwitcherAlwaysVisibleAtom
  );
  const reorder = useMobileReorder({
    ids: orderedEntries.map((e) => e.id),
    onReorder: commitReorder,
  });

  if (!canEdit) return null;

  return (
    <>
      <p
        className={clsx(
          "text-xs font-medium uppercase tracking-wider mt-8 mb-3 px-1",
          "text-ink-4"
        )}
      >
        Espaces
      </p>
      <div style={{ filter: "var(--shadow-card)" }}>
        <Squircle
          radius={18}
          className={clsx("overflow-hidden border", "bg-surface border-line")}
        >
          {/* `relative` : repère de mesure des lignes (useMobileReorder) et
              couche positionnée, pour que la ligne soulevée passe au-dessus du
              bouton "Ajouter un espace" qui la suit dans le flux. */}
          <div ref={reorder.listRef} className="relative">
            {orderedEntries.map((entry, i) => {
              const isLast = i === orderedEntries.length - 1;
              if (entry.id === ALL_SPACE_ID) {
                return (
                  <ToutRow
                    key="__all__"
                    icon={toutIcon}
                    onIconChange={setToutIcon}
                    isLast={isLast}
                    reorder={reorder}
                  />
                );
              }
              const space = entry as VaultSpace;
              const idx = spaces.indexOf(space);
              return (
                <SpaceRow
                  key={space.id}
                  space={space}
                  index={idx}
                  onNameChange={setName}
                  onNameFocus={beginRename}
                  onNameBlur={dedupeName}
                  onIconChange={setIcon}
                  onColorChange={setColor}
                  onDelete={deleteSpace}
                  isLast={isLast}
                  reorder={reorder}
                />
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              hapticImpact("light");
              addSpace();
            }}
            className={clsx(
              "w-full px-4 py-4 text-left text-base transition-colors border-t",
              "text-accent border-line",
              "active:bg-surface-2"
            )}
          >
            + Ajouter un espace
          </button>
        </Squircle>
      </div>
      <div style={{ filter: "var(--shadow-card)" }} className="mt-3">
        <Squircle
          radius={18}
          className={clsx("overflow-hidden border", "bg-surface border-line")}
        >
          <label className="flex items-center justify-between px-4 py-3 cursor-pointer">
            <span className="text-base text-ink-2">
              Sélecteur d'espaces toujours visible
            </span>
            <input
              type="checkbox"
              checked={switcherAlwaysVisible}
              onChange={(e) => {
                hapticImpact("light");
                setSwitcherAlwaysVisible(e.target.checked);
              }}
              className={clsx("w-5 h-5 rounded cursor-pointer", "accent-ink")}
            />
          </label>
        </Squircle>
      </div>
      <p className={clsx("mt-2 text-xs px-1", "text-ink-4")}>
        Taguez vos notes avec{" "}
        <code className={clsx("font-mono px-1 rounded", "bg-surface-3")}>
          __Space__
        </code>{" "}
        pour les associer à un espace.
      </p>
    </>
  );
}
