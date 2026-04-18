import { sfXmark } from "@bradleyhodges/sfsymbols";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import { useEffect, useRef } from "react";
import { createLogger } from "../../shared/lib/logger";
import { useKeyboardHeight } from "../hooks/useKeyboardHeight";

const log = createLogger("FloatingInput");

interface Props {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onClose?: () => void;
  placeholder?: string;
  enterKeyHint?: "search" | "done" | "go" | "next" | "send";
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
  label?: string;
}

export function FloatingInput({ onClose, label }: Props) {
  const { keyboardHeight } = useKeyboardHeight();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    log.info("montage, focus auto");
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="fixed left-0 right-0 z-50 px-3 py-2 bg-white/95 backdrop-blur-sm border-t border-gray-100"
      style={{
        bottom: keyboardHeight,
        paddingBottom:
          keyboardHeight === 0 ? "env(safe-area-inset-bottom)" : undefined,
      }}
    >
      {label && (
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 px-1">
          {label}
        </p>
      )}
      <div className="flex items-center gap-2">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="size-9 shrink-0 flex items-center justify-center rounded-full text-gray-400 active:bg-gray-100 transition-colors"
          >
            <SFIcon icon={sfXmark} className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
