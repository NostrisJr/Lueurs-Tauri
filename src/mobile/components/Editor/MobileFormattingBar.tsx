import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Editor } from "../../../shared/components/NoteEditor/MarkdownEditor";
import {
  editorBlockquote,
  editorBold,
  editorBulletList,
  editorCodeBlock,
  editorDedent,
  editorDidascalieInline,
  editorHeading,
  editorHighlight,
  editorIndent,
  editorInlineCode,
  editorInsertFormula,
  editorItalic,
  editorOrderedList,
  editorParagraph,
  editorPoetry,
  editorStrike,
  editorTaskList,
} from "../../../shared/components/NoteEditor/lib/editorCommands";
import {
  IconAppleTerminalFill,
  IconBold,
  IconCharacterSquare,
  IconChartBarYaxis,
  IconChecklist,
  IconCodeInline,
  IconDecreaseIndent,
  IconHighlighter,
  IconIncreaseIndent,
  IconItalic,
  IconKeyboardChevronCompactDown,
  IconListBullet,
  IconListNumber,
  IconStrikethrough,
  IconTextformat,
} from "../../../shared/components/PlatformIcon";
import { FloatingComponent } from "../Floating/FloatingComponent";

interface Props {
  editorRef: RefObject<Editor | null>;
  keyboardHeight: number;
  isKeyboardOpen: boolean;
}

interface Btn {
  label?: string;
  Icon?: React.FC<{ className?: string }>;
  title: string;
  action: () => void;
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

  const groups: Btn[][] = [
    [
      { Icon: IconBold, title: "Gras", action: () => editorBold(editorRef) },
      {
        Icon: IconItalic,
        title: "Italique",
        action: () => editorItalic(editorRef),
      },
      {
        Icon: IconStrikethrough,
        title: "Barré",
        action: () => editorStrike(editorRef),
      },
      {
        Icon: IconHighlighter,
        title: "Surligner",
        action: () => editorHighlight(editorRef),
      },
      {
        Icon: IconCodeInline,
        title: "Code inline",
        action: () => editorInlineCode(editorRef),
        className: "font-mono",
      },
      {
        label: "|Abc|",
        title: "Didascalie inline",
        action: () => editorDidascalieInline(editorRef),
        className: "italic opacity-75",
      },
      {
        label: "ƒ",
        title: "Formule",
        action: () => editorInsertFormula(editorRef),
        className: "font-mono",
      },
      {
        Icon: IconTextformat,
        title: "Texte normal",
        action: () => editorParagraph(editorRef),
      },
    ],
    [
      {
        label: "H1",
        title: "Titre 1",
        action: () => editorHeading(editorRef, 1),
      },
      {
        label: "H2",
        title: "Titre 2",
        action: () => editorHeading(editorRef, 2),
      },
      {
        label: "H3",
        title: "Titre 3",
        action: () => editorHeading(editorRef, 3),
      },
      {
        label: "H4",
        title: "Titre 4",
        action: () => editorHeading(editorRef, 4),
      },
      {
        label: "H5",
        title: "Titre 5",
        action: () => editorHeading(editorRef, 5),
      },
      {
        label: "H6",
        title: "Titre 6",
        action: () => editorHeading(editorRef, 6),
      },
    ],
    [
      {
        Icon: IconListBullet,
        title: "Liste à puces",
        action: () => editorBulletList(editorRef),
      },
      {
        Icon: IconListNumber,
        title: "Liste numérotée",
        action: () => editorOrderedList(editorRef),
      },
      {
        Icon: IconChecklist,
        title: "Liste de tâches",
        action: () => editorTaskList(editorRef),
      },
      {
        Icon: IconIncreaseIndent,
        title: "Indenter",
        action: () => editorIndent(editorRef),
      },
      {
        Icon: IconDecreaseIndent,
        title: "Désindenter",
        action: () => editorDedent(editorRef),
      },
    ],
    [
      {
        Icon: IconCharacterSquare,
        title: "Citation",
        action: () => editorBlockquote(editorRef),
      },
      {
        Icon: IconAppleTerminalFill,
        title: "Bloc de code",
        action: () => editorCodeBlock(editorRef),
        className: "font-mono text-xs",
      },
      {
        Icon: IconChartBarYaxis,
        title: "Poésie",
        action: () => editorPoetry(editorRef),
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
      <FloatingComponent wrapperClassName="flex-1 min-w-0" className="overflow-hidden px-0 py-0">
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
                  ev.preventDefault();
                  dragRef.current = { isDragging: false, startX: ev.clientX };
                }}
                onPointerMove={(ev) => {
                  if (Math.abs(ev.clientX - dragRef.current.startX) > 8) {
                    dragRef.current.isDragging = true;
                  }
                }}
                onPointerUp={() => {
                  if (!dragRef.current.isDragging) item.action();
                }}
                className={`shrink-0 min-w-9 h-9 flex items-center justify-center px-2 rounded-full text-black hover:bg-white/20 active:bg-white/30 transition-colors select-none ${item.className ?? ""}`}
              >
                {item.Icon ? (
                  <item.Icon className="size-5" />
                ) : (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </button>
            )
          )}
        </div>
      </FloatingComponent>
      <FloatingComponent
        wrapperClassName="shrink-0"
        className="w-13 h-13 rounded-full! p-0! gap-0!"
        bgColor="rgba(249, 250, 251, 0.75)"
      >
        <button
          type="button"
          title="Fermer le clavier"
          onPointerDown={(ev) => ev.preventDefault()}
          onPointerUp={() => (document.activeElement as HTMLElement)?.blur()}
          className="w-full h-full flex items-center justify-center text-black active:bg-white/30 transition-colors rounded-full"
        >
          <IconKeyboardChevronCompactDown className="size-5" />
        </button>
      </FloatingComponent>
    </div>
  );
}
