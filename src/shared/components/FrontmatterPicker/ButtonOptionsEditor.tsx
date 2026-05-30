import {
  type ButtonDef,
  type ButtonOption,
  serializeButton,
} from "../../lib/FrontmatterPicker/buttonProperty";
import { pillClasses } from "../../lib/FrontmatterPicker/enumPillColors";
import { ColorDotPicker } from "./ColorDotPicker";

interface Props {
  def: ButtonDef;
  /** Reçoit la formule BUTTON sérialisée après changement de couleur. */
  onChange: (formula: string) => void;
  /** Clic sur le fond → édition brute de la formule (renommer/ajouter des valeurs). */
  onEditRaw: () => void;
}

/**
 * Vue compactée d'une propriété BUTTON dans le frontmatter d'un template :
 * les valeurs possibles apparaissent surlignées de leur couleur, avec un dot
 * au survol pour rechoisir la couleur (même mécanisme que le surlignage md).
 */
export function ButtonOptionsEditor({ def, onChange, onEditRaw }: Props) {
  function setColor(index: number, color: string | undefined) {
    const options = def.options.map((o, i) =>
      i === index ? { ...o, color } : o
    );
    onChange(serializeButton({ ...def, options }));
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: clic sur le fond → édition brute
    <div
      className="flex flex-wrap gap-1 flex-1 mt-0.5 cursor-pointer"
      title="Cliquer pour éditer les valeurs"
      onClick={onEditRaw}
    >
      {def.options.map((opt, i) => (
        <OptionPill
          key={`${opt.value}-${i}`}
          option={opt}
          onColor={(c) => setColor(i, c)}
        />
      ))}
      {def.options.length === 0 && (
        <span className="text-gray-300 italic text-xs">aucune valeur</span>
      )}
    </div>
  );
}

function OptionPill({
  option,
  onColor,
}: {
  option: ButtonOption;
  onColor: (color: string | undefined) => void;
}) {
  return (
    <span className="relative inline-flex items-center group/opt">
      <span
        className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${pillClasses(option.color)}`}
      >
        {option.value}
      </span>
      <ColorDotPicker
        color={option.color}
        onColor={onColor}
        className="absolute -top-1 -left-1 size-3 rounded-full border border-white shadow-sm opacity-0 group-hover/opt:opacity-100 transition-opacity cursor-pointer"
      />
    </span>
  );
}
