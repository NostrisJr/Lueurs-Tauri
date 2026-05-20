// Point d'entrée unique pour toutes les icônes de l'app.
// iOS/macOS → SF Symbols natifs via SFIcon
// Android   → Material Symbols Rounded (police Google, font-based)

import {
  sfAppendPage,
  sfAppleTerminalFill,
  sfArrowClockwise,
  sfArrowRight,
  sfArrowUturnBackward,
  sfArrowUturnForward,
  sfBold,
  sfBooksVertical,
  sfChartBarYaxis,
  sfChecklist,
  sfCheckmark,
  sfChevronDown,
  sfChevronLeft,
  sfChevronLeftForwardslashChevronRight,
  sfChevronRight,
  sfCylinderSplit1x2,
  sfCylinderSplit1x2Fill,
  sfDecreaseIndent,
  sfDocument,
  sfDocumentBadgePlus,
  sfEllipsis,
  sfFolder,
  sfFolderBadgePlus,
  sfGearshape,
  sfIncreaseIndent,
  sfItalic,
  sfKeyboardChevronCompactDown,
  sfListBullet,
  sfListNumber,
  sfMagnifyingglass,
  sfMicrophoneFill,
  sfPauseFill,
  sfPlayFill,
  sfPlus,
  sfPlusCircle,
  sfQuoteOpening,
  sfRectangleStack,
  sfSidebarLeft,
  sfStopFill,
  sfStrikethrough,
  sfTextDocument,
  sfTextRectanglePage,
  sfTextformat,
  sfTrash,
  sfWaveform,
  sfXCircle,
  sfXmark,
} from "@bradleyhodges/sfsymbols";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import type { MaterialSymbol } from "material-symbols";

import { isAndroid } from "../lib/platform";

type P = { className?: string };

// ── Factories ────────────────────────────────────────────────────────────────

// Extrait la valeur size-N du className Tailwind et la convertit en font-size.
// Les icônes Material Symbols sont font-based : font-size pilote leur taille,
// pas width/height. Les consommateurs passent size-* → on les traduit ici.
function sizeToFontSize(cls = ""): React.CSSProperties {
  const match = cls.match(/\bsize-(\d+(?:\.\d+)?)\b/);
  if (!match) return {};
  return { fontSize: `${Number.parseFloat(match[1]) * 0.25}rem` };
}

function MaterialIcon({
  name,
  className,
  fill = false,
}: P & { name: MaterialSymbol; fill?: boolean }) {
  const style: React.CSSProperties = {
    ...sizeToFontSize(className),
    ...(fill ? { fontVariationSettings: "'FILL' 1" } : {}),
  };
  return (
    <span
      className={`material-symbols-rounded ${className ?? ""}`}
      style={style}
      aria-hidden
    >
      {name}
    </span>
  );
}

function mk(symbol: unknown, name: MaterialSymbol, fill = false): React.FC<P> {
  return function Icon({ className }) {
    if (isAndroid)
      return <MaterialIcon name={name} className={className} fill={fill} />;
    return <SFIcon icon={symbol as never} className={className} />;
  };
}

// ── Icônes ───────────────────────────────────────────────────────────────────

export const IconAppleTerminalFill = mk(sfAppleTerminalFill, "terminal");

// templates de notes
export const IconAppendPage = mk(sfAppendPage, "note_stack");

// refresh du vault (sidebar)
export const IconArrowClockwise = mk(sfArrowClockwise, "refresh");

export const IconArrowRight = mk(sfArrowRight, "arrow_forward");

// undo
export const IconArrowUturnBackward = mk(sfArrowUturnBackward, "undo");

// redo
export const IconArrowUturnForward = mk(sfArrowUturnForward, "redo");

// gras (toolbar markdown)
export const IconBold = mk(sfBold, "format_bold");

// mode livre
export const IconBooksVertical = mk(sfBooksVertical, "book_5");

// bloc citation (toolbar markdown)
export const IconCharacterSquare = mk(sfQuoteOpening, "format_quote");

// bloc poésie (toolbar markdown)
export const IconChartBarYaxis = mk(sfChartBarYaxis, "align_horizontal_left");

// indicateur de sauvegarde réussie
export const IconCheckmark = mk(sfCheckmark, "check");

// todo (toolbar markdown)
export const IconChecklist = mk(sfChecklist, "checklist");

export const IconChevronDown = mk(sfChevronDown, "keyboard_arrow_down");

export const IconChevronLeft = mk(sfChevronLeft, "chevron_left");

// code inline (toolbar markdown)
export const IconCodeInline = mk(sfChevronLeftForwardslashChevronRight, "code");

export const IconChevronRight = mk(sfChevronRight, "chevron_right");

// base de données vide (filetree)
export const IconCylinderSplit1x2 = mk(sfCylinderSplit1x2, "database");

// base de données remplie (filetree)
export const IconCylinderSplit1x2Fill = mk(
  sfCylinderSplit1x2Fill,
  "database",
  true
);

export const IconDecreaseIndent = mk(
  sfDecreaseIndent,
  "format_indent_decrease"
);

// icône de note (filetree)
export const IconDocument = mk(sfDocument, "description");

// création de note (filetree)
export const IconDocumentBadgePlus = mk(sfDocumentBadgePlus, "note_add");

export const IconEllipsis = mk(sfEllipsis, "more_horiz");

export const IconFolder = mk(sfFolder, "folder_open");

export const IconFolderBadgePlus = mk(sfFolderBadgePlus, "create_new_folder");

export const IconGearshape = mk(sfGearshape, "settings");

export const IconIncreaseIndent = mk(
  sfIncreaseIndent,
  "format_indent_increase"
);

export const IconItalic = mk(sfItalic, "format_italic");

export const IconKeyboardChevronCompactDown = mk(
  sfKeyboardChevronCompactDown,
  "keyboard_hide"
);

export const IconListBullet = mk(sfListBullet, "format_list_bulleted");

export const IconListNumber = mk(sfListNumber, "format_list_numbered");

export const IconMagnifyingglass = mk(sfMagnifyingglass, "search");

export const IconMicrophoneFill = mk(sfMicrophoneFill, "mic", true);

export const IconPauseFill = mk(sfPauseFill, "pause", true);

export const IconPlayFill = mk(sfPlayFill, "play_arrow", true);

export const IconPlus = mk(sfPlus, "add");

export const IconPlusCircle = mk(sfPlusCircle, "add_circle");

export const IconRectangleStack = mk(sfRectangleStack, "layers");

// sidebar
export const IconSidebarLeft = mk(sfSidebarLeft, "dock_to_right");

export const IconStopFill = mk(sfStopFill, "stop", true);

export const IconStrikethrough = mk(sfStrikethrough, "format_strikethrough");

export const IconTextDocument = mk(sfTextDocument, "docs");

export const IconTextformat = mk(sfTextformat, "match_case");

export const IconTextRectanglePage = mk(sfTextRectanglePage, "article");

export const IconTrash = mk(sfTrash, "delete");

export const IconWaveform = mk(sfWaveform, "graphic_eq");

export const IconXCircle = mk(sfXCircle, "cancel");

export const IconXmark = mk(sfXmark, "close");
