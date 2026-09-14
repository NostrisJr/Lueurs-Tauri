import clsx from "clsx";
import { useRef, useState } from "react";
import { AnchoredDropdown } from "../../../shared/components/AnchoredDropdown";
import type { getAddableFields } from "../../../shared/lib/noteTypes";
import { isMobile } from "../../../shared/lib/platform";

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
        className={clsx(
          "text-ink-5 hover:text-ink-3 text-left transition-colors cursor-pointer select-none",
          isMobile ? "text-sm mt-1 py-1" : "text-xs mt-0.5"
        )}
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
              <p
                className={clsx(
                  "px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide",
                  "text-ink-4"
                )}
              >
                Propriétés système
              </p>
              {addableFields.map((field) => (
                <button
                  key={field.key}
                  type="button"
                  onClick={() => handleAddSystem(field.key)}
                  title={field.description}
                  className={clsx(
                    "w-full text-left hover:bg-surface-2 active:bg-surface-2 transition-colors",
                    isMobile ? "px-4 py-3 text-sm" : "px-3 py-1.5 text-xs"
                  )}
                >
                  <span className="font-bold text-ink-2">{field.label}</span>
                  <span className="ml-2 text-ink-4">{field.description}</span>
                </button>
              ))}
              <div className="border-t border-line my-1" />
            </div>
          )}
          <button
            type="button"
            onClick={handleAddUser}
            className={clsx(
              "w-full text-left text-ink-2 hover:bg-surface-2 active:bg-surface-2 transition-colors",
              isMobile ? "px-4 py-3 text-sm" : "px-3 py-1.5 text-xs"
            )}
          >
            <span className="font-bold text-ink-2">
              Propriété personnalisée
            </span>
            <span className="ml-2 text-ink-4">Ce que vous voulez...</span>
          </button>
        </AnchoredDropdown>
      )}
    </div>
  );
}
