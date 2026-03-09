import { useRef, useState } from "react";
import { AnchoredDropdown } from "./AnchoredDropdown";
import { getAddableFields } from "../../lib/noteTypes";

interface Props {
  addableFields: ReturnType<typeof getAddableFields>;
  onAddSystem: (key: string) => void;
  onAddUser: () => void;
}

export function AddPropertyDropdown({
  addableFields,
  onAddSystem,
  onAddUser,
}: Props) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function handleAddSystem(key: string) {
    onAddSystem(key);
    setOpen(false);
  }

  function handleAddUser() {
    onAddUser();
    setOpen(false);
  }

  return (
    <div>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-gray-300 hover:text-gray-500 text-left transition-colors cursor-pointer mt-0.5"
      >
        + propriété
      </button>

      {open && (
        <AnchoredDropdown
          anchorRef={buttonRef}
          onClose={() => setOpen(false)}
          className="w-56"
        >
          {addableFields.length > 0 && (
            <div>
              <p className="px-3 pt-2 pb-1 text-[10px] text-gray-400 uppercase tracking-wide">
                Propriétés système
              </p>
              {addableFields.map((field) => (
                <button
                  key={field.key}
                  type="button"
                  onClick={() => handleAddSystem(field.key)}
                  title={field.description}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors"
                >
                  <span className="font-bold text-gray-600">{field.label}</span>
                  <span className="ml-2 text-gray-400">
                    {field.description}
                  </span>
                </button>
              ))}
              <div className="border-t border-gray-100 my-1" />
            </div>
          )}
          <button
            type="button"
            onClick={handleAddUser}
            className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Propriété personnalisée
          </button>
        </AnchoredDropdown>
      )}
    </div>
  );
}
