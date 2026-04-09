import { useRef, useState } from "react";
import { platform } from "@tauri-apps/plugin-os";
import { AnchoredDropdown } from "./AnchoredDropdown";
import type { getAddableFields } from "../../lib/noteTypes";

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
  const isMobile = platform() === "ios";
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
        className={`text-gray-300 hover:text-gray-500 text-left transition-colors cursor-pointer select-none ${isMobile ? "text-sm mt-1 py-1" : "text-xs mt-0.5"}`}
      >
        + propriété
      </button>

      {open && (
        <AnchoredDropdown
          anchorRef={buttonRef}
          onClose={() => setOpen(false)}
          className="w-70"
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
                  className={`w-full text-left hover:bg-gray-50 active:bg-gray-50 transition-colors ${isMobile ? "px-4 py-3 text-sm" : "px-3 py-1.5 text-xs"}`}
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
            className={`w-full text-left text-gray-600 hover:bg-gray-50 active:bg-gray-50 transition-colors ${isMobile ? "px-4 py-3 text-sm" : "px-3 py-1.5 text-xs"}`}
          >
            <span className="font-bold text-gray-600">
              Propriété personnalisée
            </span>
            <span className="ml-2 text-gray-400">Ce que vous voulez...</span>
          </button>
        </AnchoredDropdown>
      )}
    </div>
  );
}
