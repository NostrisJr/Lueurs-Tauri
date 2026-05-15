import {
  sfAppleTerminalFill,
  sfBold,
  sfCharacterSquare,
  sfChartBarYaxis,
  sfChecklist,
  sfChevronLeftForwardslashChevronRight,
  sfDecreaseIndent,
  sfIncreaseIndent,
  sfItalic,
  sfKeyboardChevronCompactDown,
  sfListBullet,
  sfListNumber,
  sfStrikethrough,
  sfTextformat,
} from "@bradleyhodges/sfsymbols";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { EditorHandle } from "../../../shared/components/NoteEditor/MarkdownEditor";
import { FloatingComponent } from "../Floating/FloatingComponent";

interface Props {
  editorRef: RefObject<EditorHandle | null>;
  keyboardHeight: number;
  isKeyboardOpen: boolean;
}

interface Btn {
  label?: string;
  icon?: typeof sfBold;
  title: string;
  action: (e: EditorHandle) => void;
  className?: string;
}

export function MobileFormattingBar({
  editorRef,
  keyboardHeight,
  isKeyboardOpen,
}: Props) {
  // Distingue tap (< 8px de déplacement) et scroll horizontal
  const dragRef = useRef({ isDragging: false, startX: 0 });
  const [rendered, setRendered] = useState(isKeyboardOpen);
  const [visible, setVisible] = useState(isKeyboardOpen);

  useEffect(() => {
    if (isKeyboardOpen) {
      setRendered(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const t = setTimeout(() => setRendered(false), 300);
    return () => clearTimeout(t);
  }, [isKeyboardOpen]);

  if (!rendered) return null;

  const e = () => editorRef.current;

  const groups: Btn[][] = [
    [
      { icon: sfBold, title: "Gras", action: (ed) => ed.bold() },
      { icon: sfItalic, title: "Italique", action: (ed) => ed.italic() },
      { icon: sfStrikethrough, title: "Barré", action: (ed) => ed.strike() },
      {
        icon: sfChevronLeftForwardslashChevronRight,
        title: "Code inline",
        action: (ed) => ed.inlineCode(),
        className: "font-mono",
      },
      {
        label: "|Abc|",
        title: "Didascalie inline",
        action: (ed) => ed.didascalieInline(),
        className: "italic opacity-75",
      },
      {
        icon: sfTextformat,
        title: "Texte normal",
        action: (ed) => ed.paragraph(),
      },
    ],
    [
      { label: "H1", title: "Titre 1", action: (ed) => ed.heading(1) },
      { label: "H2", title: "Titre 2", action: (ed) => ed.heading(2) },
      { label: "H3", title: "Titre 3", action: (ed) => ed.heading(3) },
      { label: "H4", title: "Titre 4", action: (ed) => ed.heading(4) },
      { label: "H5", title: "Titre 5", action: (ed) => ed.heading(5) },
      { label: "H6", title: "Titre 6", action: (ed) => ed.heading(6) },
    ],
    [
      {
        icon: sfListBullet,
        title: "Liste à puces",
        action: (ed) => ed.bulletList(),
      },
      {
        icon: sfListNumber,
        title: "Liste numérotée",
        action: (ed) => ed.orderedList(),
      },
      {
        icon: sfChecklist,
        title: "Liste de tâches",
        action: (ed) => ed.taskList(),
      },
      {
        icon: sfIncreaseIndent,
        title: "Indenter",
        action: (ed) => ed.indent(),
      },

      {
        icon: sfDecreaseIndent,
        title: "Désindenter",
        action: (ed) => ed.dedent(),
      },
    ],
    [
      {
        icon: sfCharacterSquare,
        title: "Citation",
        action: (ed) => ed.blockquote(),
      },
      {
        icon: sfAppleTerminalFill,
        title: "Bloc de code",
        action: (ed) => ed.codeBlock(),
        className: "font-mono text-xs",
      },
      { icon: sfChartBarYaxis, title: "Poésie", action: (ed) => ed.poetry() },
      {
        label: "(D)",
        title: "Bloc didascalie",
        action: (ed) => ed.didascalieBlock(),
        className: "italic opacity-75 text-xs",
      },
    ],
  ];

  const items = groups.flatMap((group, i) =>
    i === 0 ? group : (["sep" as const, ...group] as (Btn | "sep")[])
  );

  return (
    <div
      className={`fixed left-3 right-3 z-50 flex items-center gap-2 transition-all duration-300 ease-in-out ${visible ? "translate-y-0 opacity-100" : "translate-y-16 opacity-0"}`}
      style={{ bottom: keyboardHeight + 8 }}
    >
      <FloatingComponent className="flex-1 overflow-hidden px-0 py-0 bg-white/70">
        <div
          className="flex items-center overflow-x-auto h-13 px-2 gap-1"
          style={{ scrollbarWidth: "none" }}
        >
          {items.map((item, i) =>
            item === "sep" ? (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: liste stable
                key={i}
                className="shrink-0 w-px h-5 bg-gray-300 mx-1.5"
                aria-hidden
              />
            ) : (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: liste stable
                key={i}
                type="button"
                title={item.title}
                onPointerDown={(ev) => {
                  // Empêche le blur de l'éditeur ; enregistre la position de départ
                  ev.preventDefault();
                  dragRef.current = { isDragging: false, startX: ev.clientX };
                }}
                onPointerMove={(ev) => {
                  if (Math.abs(ev.clientX - dragRef.current.startX) > 8) {
                    dragRef.current.isDragging = true;
                  }
                }}
                onPointerUp={() => {
                  // N'exécute l'action que si c'était un tap, pas un scroll
                  if (!dragRef.current.isDragging) {
                    const ed = e();
                    if (ed) item.action(ed);
                  }
                }}
                className={`shrink-0 min-w-9 h-9 flex items-center justify-center px-2 rounded-full text-black hover:bg-white/20 active:bg-white/30 transition-colors select-none ${item.className ?? ""}`}
              >
                {item.icon ? (
                  <SFIcon icon={item.icon} className="size-5" />
                ) : (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </button>
            )
          )}
        </div>
      </FloatingComponent>
      <FloatingComponent className="shrink-0 w-13 h-13 !rounded-full !p-0 gap-0! bg-white/70">
        <button
          type="button"
          title="Fermer le clavier"
          onPointerDown={(ev) => ev.preventDefault()}
          onPointerUp={() => (document.activeElement as HTMLElement)?.blur()}
          className="w-full h-full flex items-center justify-center text-black active:bg-white/30 transition-colors rounded-full"
        >
          <SFIcon icon={sfKeyboardChevronCompactDown} className="size-5" />
        </button>
      </FloatingComponent>
    </div>
  );
}
