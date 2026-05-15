import { sfMicrophoneFill } from "@bradleyhodges/sfsymbols";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import clsx from "clsx";
import type { RefObject } from "react";
import type { EditorHandle } from "./MarkdownEditor";

interface Props {
  editorRef: RefObject<EditorHandle | null>;
  onRecord?: () => void;
}

interface ToolbarButton {
  label: string;
  title: string;
  shortcut?: string;
  action: () => void;
}

interface ToolbarGroup {
  buttons: ToolbarButton[];
}

export function EditorToolbar({ editorRef, onRecord }: Props) {
  const e = () => editorRef.current;

  const groups: ToolbarGroup[] = [
    {
      // TODO : la compléter
      buttons: [
        {
          label: "B",
          title: "Gras",
          shortcut: "⌘B",
          action: () => e()?.bold(),
        },
        {
          label: "I",
          title: "Italique",
          shortcut: "⌘I",
          action: () => e()?.italic(),
        },
        {
          label: "S",
          title: "Barré",
          action: () => e()?.strike(),
        },
      ],
    },
    {
      buttons: [
        { label: "H1", title: "Titre 1", action: () => e()?.heading(1) },
        { label: "H2", title: "Titre 2", action: () => e()?.heading(2) },
        { label: "H3", title: "Titre 3", action: () => e()?.heading(3) },
      ],
    },
  ];

  return (
    <div className="flex items-center gap-1 px-4 py-1 border-b border-gray-100 bg-white">
      {groups.map((group, gi) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
        <div key={gi} className="flex items-center gap-0.5">
          {gi > 0 && <div className="w-px h-4 bg-gray-200 mx-1" aria-hidden />}
          {group.buttons.map((btn) => (
            <button
              key={btn.label}
              type="button"
              title={
                btn.shortcut ? `${btn.title} (${btn.shortcut})` : btn.title
              }
              onClick={btn.action}
              className={clsx(
                "px-2 py-0.5 rounded text-xs font-medium text-gray-500",
                "hover:bg-gray-100 hover:text-gray-800",
                "active:bg-gray-200",
                "transition-colors cursor-default select-none",
                // Style spécifique par bouton
                btn.label === "B" && "font-bold",
                btn.label === "I" && "italic",
                btn.label === "S" && "line-through"
              )}
            >
              {btn.label}
            </button>
          ))}
        </div>
      ))}
      {onRecord && (
        <>
          <div className="w-px h-4 bg-gray-200 mx-1" aria-hidden />
          <SFIcon
            icon={sfMicrophoneFill}
            className="size-4 px-2 py-0.5 text-gray-500 hover:text-red-500 transition-colors bg-transparent rounded hover:bg-gray-100"
            aria-hidden="true"
            onClick={onRecord}
            title="Enregistrement vocal"
          />
        </>
      )}
    </div>
  );
}
