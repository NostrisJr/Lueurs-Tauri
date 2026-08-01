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
      className="shrink-0 text-gray-300 px-2 -mx-1 py-2 -my-2"
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
      className={`flex items-center gap-2 px-3 py-3 bg-white ${
        isLast ? "" : "border-b border-gray-100"
      }`}
    >
      <DragHandle id={ALL_SPACE_ID} reorder={reorder} />
      <MobileEmojiField value={icon} onChange={onIconChange} />
      {/* Espacement équivalent au champ couleur */}
      <div className="w-9 shrink-0" />
      <span className="flex-1 text-base text-gray-400 px-2.5 py-2 select-none">
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
      className={`flex items-center gap-2 px-3 py-3 bg-white ${
        isLast ? "" : "border-b border-gray-100"
      }`}
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
          className="block w-9 h-9 rounded-lg border-2 border-white shadow ring-1 ring-gray-200"
          style={{
            background: space.color
              ? `linear-gradient(135deg, ${space.color}, ${space.color}99)`
              : "linear-gradient(135deg, #e5e7eb, #d1d5db)",
          }}
        />
        <input
          type="color"
          value={space.color ?? "#6366f1"}
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
        className="flex-1 min-w-0 text-base border border-gray-200 rounded-lg px-2.5 py-2 outline-none focus:border-gray-400"
        placeholder="Nom de l'espace"
        aria-label="Nom de l'espace"
      />

      <button
        type="button"
        onClick={() => {
          hapticImpact("medium");
          onDelete(index);
        }}
        className="shrink-0 text-gray-400 active:text-red-500 transition-colors text-2xl leading-none px-1"
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
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mt-8 mb-3 px-1">
        Espaces
      </p>
      <div style={{ filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.06))" }}>
        <Squircle
          radius={18}
          className="overflow-hidden bg-white border border-gray-100"
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
            className="w-full px-4 py-4 text-left text-base text-amber-500 active:bg-gray-50 transition-colors border-t border-gray-100"
          >
            + Ajouter un espace
          </button>
        </Squircle>
      </div>
      <div
        style={{ filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.06))" }}
        className="mt-3"
      >
        <Squircle
          radius={18}
          className="overflow-hidden bg-white border border-gray-100"
        >
          <label className="flex items-center justify-between px-4 py-3 cursor-pointer">
            <span className="text-base text-gray-700">
              Sélecteur d'espaces toujours visible
            </span>
            <input
              type="checkbox"
              checked={switcherAlwaysVisible}
              onChange={(e) => {
                hapticImpact("light");
                setSwitcherAlwaysVisible(e.target.checked);
              }}
              className="w-5 h-5 rounded accent-gray-800 cursor-pointer"
            />
          </label>
        </Squircle>
      </div>
      <p className="mt-2 text-xs text-gray-400 px-1">
        Taguez vos notes avec{" "}
        <code className="font-mono bg-gray-100 px-1 rounded">__space__</code>{" "}
        pour les associer à un espace.
      </p>
    </>
  );
}
