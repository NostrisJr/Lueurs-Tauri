// Point d'entrée unique pour toutes les icônes de l'app.
// iOS/macOS → SF Symbols natifs via SFIcon (licence Apple, réservée aux plateformes Apple)
// Autres    → Material Symbols, résolues à la demande par unplugin-icons (~icons/material-symbols/*)

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
  sfDocumentViewfinder,
  sfEllipsis,
  sfFilm,
  sfFolder,
  sfFolderBadgePlus,
  sfGearshape,
  sfHighlighter,
  sfIncreaseIndent,
  sfItalic,
  sfKeyboardChevronCompactDown,
  sfListBullet,
  sfListNumber,
  sfMagnifyingglass,
  sfPauseFill,
  sfPhoto,
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

import MsAddCircle from "~icons/material-symbols/add-circle-outline-rounded";
import MsAdd from "~icons/material-symbols/add-rounded";
import MsAlignHorizontalLeft from "~icons/material-symbols/align-horizontal-left-rounded";
import MsArrowForward from "~icons/material-symbols/arrow-forward-rounded";
import MsArticle from "~icons/material-symbols/article-outline-rounded";
import MsBook5 from "~icons/material-symbols/book-5-outline-rounded";
import MsCancel from "~icons/material-symbols/cancel-outline-rounded";
import MsCheck from "~icons/material-symbols/check-rounded";
import MsChecklist from "~icons/material-symbols/checklist-rounded";
import MsChevronLeft from "~icons/material-symbols/chevron-left-rounded";
import MsChevronRight from "~icons/material-symbols/chevron-right-rounded";
import MsClose from "~icons/material-symbols/close-rounded";
import MsCode from "~icons/material-symbols/code-rounded";
import MsCreateNewFolder from "~icons/material-symbols/create-new-folder-outline-rounded";
import MsDatabase from "~icons/material-symbols/database";
import MsDatabaseOutline from "~icons/material-symbols/database-outline";
import MsTrash from "~icons/material-symbols/delete-outline-rounded";
import MsDescription from "~icons/material-symbols/description-outline-rounded";
import MsDockToRight from "~icons/material-symbols/dock-to-right-outline";
import MsTextDocument from "~icons/material-symbols/docs-outline-rounded";
import MsFolderOpen from "~icons/material-symbols/folder-open-outline-rounded";
import MsFormatBold from "~icons/material-symbols/format-bold-rounded";
import MsFormatIndentDecrease from "~icons/material-symbols/format-indent-decrease-rounded";
import MsFormatIndentIncrease from "~icons/material-symbols/format-indent-increase-rounded";
import MsFormatInkHighlighter from "~icons/material-symbols/format-ink-highlighter-outline-rounded";
import MsFormatItalic from "~icons/material-symbols/format-italic-rounded";
import MsFormatListBulleted from "~icons/material-symbols/format-list-bulleted-rounded";
import MsFormatListNumbered from "~icons/material-symbols/format-list-numbered-rounded";
import MsFormatQuote from "~icons/material-symbols/format-quote-outline-rounded";
import MsFormatStrikethrough from "~icons/material-symbols/format-strikethrough-rounded";
import MsGraphicEq from "~icons/material-symbols/graphic-eq-rounded";
import MsImage from "~icons/material-symbols/image-outline-rounded";
import MsKeyboardArrowDown from "~icons/material-symbols/keyboard-arrow-down-rounded";
import MsKeyboardHide from "~icons/material-symbols/keyboard-hide-outline-rounded";
import MsLayers from "~icons/material-symbols/layers-outline-rounded";
import MsMatchCase from "~icons/material-symbols/match-case-rounded";
import MsMoreHoriz from "~icons/material-symbols/more-horiz";
import MsMovie from "~icons/material-symbols/movie-outline-rounded";
import MsNoteAdd from "~icons/material-symbols/note-add-outline-rounded";
import MsNoteStack from "~icons/material-symbols/note-stack-outline-rounded";
import MsPause from "~icons/material-symbols/pause-rounded";
import MsPictureAsPdf from "~icons/material-symbols/picture-as-pdf-outline-rounded";
import MsPlayArrow from "~icons/material-symbols/play-arrow-rounded";
import MsRedo from "~icons/material-symbols/redo-rounded";
import MsRefresh from "~icons/material-symbols/refresh-rounded";
import MsSearch from "~icons/material-symbols/search-rounded";
import MsSettings from "~icons/material-symbols/settings-outline-rounded";
import MsStop from "~icons/material-symbols/stop-rounded";
import MsTerminal from "~icons/material-symbols/terminal-rounded";
import MsUndo from "~icons/material-symbols/undo-rounded";

import { isApplePlatform } from "../lib/platform";

type P = { className?: string };
type SvgComponent = React.FunctionComponent<React.SVGProps<SVGSVGElement>>;

// ── Factories ────────────────────────────────────────────────────────────────

function MaterialIcon({ Icon, className }: P & { Icon: SvgComponent }) {
  return (
    <Icon
      className={`inline-block align-middle overflow-visible box-content h-[1em] w-[1em] -leading-[0.125em] ${className ?? ""}`}
      aria-hidden="true"
    />
  );
}

function mk(symbol: unknown, MaterialSvg: SvgComponent): React.FC<P> {
  return function Icon({ className }) {
    if (isApplePlatform)
      return <SFIcon icon={symbol as never} className={className} />;
    return <MaterialIcon Icon={MaterialSvg} className={className} />;
  };
}

// ── Icônes ───────────────────────────────────────────────────────────────────

export const IconAppleTerminalFill = mk(sfAppleTerminalFill, MsTerminal);

// templates de notes
export const IconAppendPage = mk(sfAppendPage, MsNoteStack);

// refresh du vault (sidebar)
export const IconArrowClockwise = mk(sfArrowClockwise, MsRefresh);

export const IconArrowRight = mk(sfArrowRight, MsArrowForward);

// undo
export const IconArrowUturnBackward = mk(sfArrowUturnBackward, MsUndo);

// redo
export const IconArrowUturnForward = mk(sfArrowUturnForward, MsRedo);

// gras (toolbar markdown)
export const IconBold = mk(sfBold, MsFormatBold);

// mode livre
export const IconBooksVertical = mk(sfBooksVertical, MsBook5);

// bloc citation (toolbar markdown)
export const IconCharacterSquare = mk(sfQuoteOpening, MsFormatQuote);

// bloc poésie (toolbar markdown)
export const IconChartBarYaxis = mk(sfChartBarYaxis, MsAlignHorizontalLeft);

// indicateur de sauvegarde réussie
export const IconCheckmark = mk(sfCheckmark, MsCheck);

// todo (toolbar markdown)
export const IconChecklist = mk(sfChecklist, MsChecklist);

export const IconChevronDown = mk(sfChevronDown, MsKeyboardArrowDown);

export const IconChevronLeft = mk(sfChevronLeft, MsChevronLeft);

// code inline (toolbar markdown)
export const IconCodeInline = mk(sfChevronLeftForwardslashChevronRight, MsCode);

export const IconChevronRight = mk(sfChevronRight, MsChevronRight);

// base de données vide (filetree)
export const IconCylinderSplit1x2 = mk(sfCylinderSplit1x2, MsDatabaseOutline);

// base de données remplie (filetree)
export const IconCylinderSplit1x2Fill = mk(sfCylinderSplit1x2Fill, MsDatabase);

export const IconDecreaseIndent = mk(sfDecreaseIndent, MsFormatIndentDecrease);

// icône de note (filetree)
export const IconDocument = mk(sfDocument, MsDescription);

// création de note (filetree)
export const IconDocumentBadgePlus = mk(sfDocumentBadgePlus, MsNoteAdd);

export const IconEllipsis = mk(sfEllipsis, MsMoreHoriz);

export const IconFolder = mk(sfFolder, MsFolderOpen);

export const IconFolderBadgePlus = mk(sfFolderBadgePlus, MsCreateNewFolder);

export const IconGearshape = mk(sfGearshape, MsSettings);

// surlignage (toolbar markdown)
export const IconHighlighter = mk(sfHighlighter, MsFormatInkHighlighter);

export const IconIncreaseIndent = mk(sfIncreaseIndent, MsFormatIndentIncrease);

export const IconItalic = mk(sfItalic, MsFormatItalic);

export const IconKeyboardChevronCompactDown = mk(
  sfKeyboardChevronCompactDown,
  MsKeyboardHide
);

export const IconListBullet = mk(sfListBullet, MsFormatListBulleted);

export const IconListNumber = mk(sfListNumber, MsFormatListNumbered);

export const IconMagnifyingglass = mk(sfMagnifyingglass, MsSearch);

export const IconRecordAudio = mk(sfWaveform, MsGraphicEq);

export const IconPauseFill = mk(sfPauseFill, MsPause);

export const IconPlayFill = mk(sfPlayFill, MsPlayArrow);

export const IconPlus = mk(sfPlus, MsAdd);

export const IconPlusCircle = mk(sfPlusCircle, MsAddCircle);

export const IconRectangleStack = mk(sfRectangleStack, MsLayers);

// sidebar
export const IconSidebarLeft = mk(sfSidebarLeft, MsDockToRight);

export const IconStopFill = mk(sfStopFill, MsStop);

export const IconStrikethrough = mk(sfStrikethrough, MsFormatStrikethrough);

export const IconTextDocument = mk(sfTextDocument, MsTextDocument);

export const IconTextformat = mk(sfTextformat, MsMatchCase);

export const IconTextRectanglePage = mk(sfTextRectanglePage, MsArticle);

export const IconTrash = mk(sfTrash, MsTrash);

export const IconWaveform = mk(sfWaveform, MsGraphicEq);

export const IconXCircle = mk(sfXCircle, MsCancel);

export const IconXmark = mk(sfXmark, MsClose);

// ── Médias ───────────────────────────────────────────────────────────────────

// image (file tree + viewer)
export const IconPhoto = mk(sfPhoto, MsImage);

// vidéo (file tree + viewer)
export const IconFilmIcon = mk(sfFilm, MsMovie);

// audio (file tree) — même icône que dans le bloc audio pour la cohérence
export const IconMusicNote = mk(sfWaveform, MsGraphicEq);

// PDF (file tree + viewer)
export const IconDocumentPdf = mk(sfDocumentViewfinder, MsPictureAsPdf);
