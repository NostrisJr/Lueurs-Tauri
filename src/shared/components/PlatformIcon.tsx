// Unique point d'entrée pour tous les SF Symbols.
// Seul ce fichier importe @bradleyhodges/sfsymbols{,-react}.
// Sur Android un SVG Heroicons-style est rendu à la place.
// Sur iOS/macOS le SF Symbol d'origine est utilisé.

import {
  sfAppleTerminalFill,
  sfAppendPage,
  sfArrowClockwise,
  sfArrowRight,
  sfArrowUturnBackward,
  sfArrowUturnForward,
  sfBold,
  sfBooksVertical,
  sfCharacterSquare,
  sfChartBarYaxis,
  sfCheckmark,
  sfChecklist,
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
  sfRectangleStack,
  sfSidebarLeft,
  sfStopFill,
  sfStrikethrough,
  sfTextDocument,
  sfTextformat,
  sfTextRectanglePage,
  sfTrash,
  sfWaveform,
  sfXCircle,
  sfXmark,
} from "@bradleyhodges/sfsymbols";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import { isAndroid } from "../lib/platform";

type P = { className?: string };

// ── Helpers SVG Android ─────────────────────────────────────────────────────

function s(...ds: string[]): React.FC<P> {
  return function Svg({ className }) {
    return (
      // biome-ignore lint/a11y/noSvgWithoutTitle: <explanation>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className={className}
      >
        {ds.map((d, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: paths statiques
          <path key={i} d={d} />
        ))}
      </svg>
    );
  };
}

function f(d: string): React.FC<P> {
  return function Svg({ className }) {
    return (
      // biome-ignore lint/a11y/noSvgWithoutTitle: <explanation>
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
        className={className}
      >
        <path d={d} />
      </svg>
    );
  };
}

function t(text: string, style?: React.CSSProperties): React.FC<P> {
  return function Txt({ className }) {
    return (
      <span className={className} style={style} aria-hidden>
        {text}
      </span>
    );
  };
}

function mk(symbol: unknown, Android: React.FC<P>): React.FC<P> {
  return function Icon({ className }) {
    if (isAndroid) return <Android className={className} />;
    return <SFIcon icon={symbol as never} className={className} />;
  };
}

// ── Icônes ──────────────────────────────────────────────────────────────────

export const IconAppleTerminalFill = mk(
  sfAppleTerminalFill,
  t(">_", {
    fontFamily: "monospace",
    fontSize: "0.8em",
    letterSpacing: "-0.04em",
  })
);

//icone des templates de notes
export const IconAppendPage = mk(
  sfAppendPage,
  s(
    "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12.75v3.75m3.75-3.75h-7.5",
    "M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
  )
);

//refresh le vault (dans la sidebar)
export const IconArrowClockwise = mk(
  sfArrowClockwise,
  s(
    "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
  )
);

export const IconArrowRight = mk(
  sfArrowRight,
  s("M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3")
);

//undo
export const IconArrowUturnBackward = mk(
  sfArrowUturnBackward,
  s("M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3")
);

//redo
export const IconArrowUturnForward = mk(
  sfArrowUturnForward,
  s("M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3")
);

export const IconBold = mk(sfBold, t("B", { fontWeight: "bold" }));

//mode livre
export const IconBooksVertical = mk(
  sfBooksVertical,
  s(
    "M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
  )
);

//bloc de citation (éditeur markdown, toolbar d'édition)
export const IconCharacterSquare = mk(
  sfCharacterSquare,
  s(
    "M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
  )
);

//bloc poésie (éditeur markdown, toolbar d'édition)
export const IconChartBarYaxis = mk(
  sfChartBarYaxis,
  s(
    "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
  )
);

//indicateur de sauvegarde du document réussie (en bas à droite de l'éditeur de note desktop)
export const IconCheckmark = mk(sfCheckmark, s("M4.5 12.75l6 6 9-13.5"));

//todo (éditeur markdown, toolbar d'édition)
export const IconChecklist = mk(
  sfChecklist,
  s(
    "M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"
  )
);

//divers dropdown, et chevoins des titres dans l'éditeur
export const IconChevronDown = mk(
  sfChevronDown,
  s("M19.5 8.25l-7.5 7.5-7.5-7.5")
);

//divers dropdown, et chevoins des titres dans l'éditeur
export const IconChevronLeft = mk(
  sfChevronLeft,
  s("M15.75 19.5L8.25 12l7.5-7.5")
);

//code inline (éditeur markdown, toolbar d'édition)
export const IconCodeInline = mk(
  sfChevronLeftForwardslashChevronRight,
  t("</>", { fontFamily: "monospace", fontSize: "0.75em" })
);

//file rows
export const IconChevronRight = mk(
  sfChevronRight,
  s("M8.25 4.5l7.5 7.5-7.5 7.5")
);

//icone des base de données vide (dans le filetree)
export const IconCylinderSplit1x2 = mk(
  sfCylinderSplit1x2,
  s(
    "M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
  )
);

//icone des base de données remplies (dans le filetree)
export const IconCylinderSplit1x2Fill = mk(
  sfCylinderSplit1x2Fill,
  f(
    "M21 6.375c0 2.692-4.03 4.875-9 4.875S3 9.067 3 6.375 7.03 1.5 12 1.5s9 2.183 9 4.875zm-9 6.375c-4.97 0-9-2.183-9-4.875v3.75c0 2.692 4.03 4.875 9 4.875s9-2.183 9-4.875v-3.75c0 2.692-4.03 4.875-9 4.875zm0 6.375c-4.97 0-9-2.183-9-4.875v3.375c0 2.692 4.03 4.875 9 4.875s9-2.183 9-4.875V14.25c0 2.692-4.03 4.875-9 4.875z"
  )
);

//décalage de paragraphe (éditeur markdown, toolbar d'édition)
export const IconDecreaseIndent = mk(
  sfDecreaseIndent,
  s(
    "M3 4.5h14.25M3 9h9.75M3 13.5h9.75M3 18h14.25M20.25 4.5l-3.75 3.75 3.75 3.75"
  )
);

//icone de note (dans le filetree)
export const IconDocument = mk(
  sfDocument,
  s(
    "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
  )
);

//icone de création de notes (filetree)
export const IconDocumentBadgePlus = mk(
  sfDocumentBadgePlus,
  s(
    "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9",
    "M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
  )
);

export const IconEllipsis = mk(
  sfEllipsis,
  s(
    "M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
  )
);

export const IconFolder = mk(
  sfFolder,
  s(
    "M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
  )
);

export const IconFolderBadgePlus = mk(
  sfFolderBadgePlus,
  s(
    "M12 10.5v6m3-3H9",
    "M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
  )
);

export const IconGearshape = mk(
  sfGearshape,
  s(
    "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28zM15 12a3 3 0 11-6 0 3 3 0 016 0z"
  )
);

export const IconIncreaseIndent = mk(
  sfIncreaseIndent,
  s("M3 4.5h14.25M3 9h9.75M3 13.5h9.75M3 18h14.25M16.5 4.5l3.75 3.75-3.75 3.75")
);

export const IconItalic = mk(sfItalic, t("I", { fontStyle: "italic" }));

export const IconKeyboardChevronCompactDown = mk(
  sfKeyboardChevronCompactDown,
  s("M3.75 9.75h16.5m-16.5 4.5h5.25m5.25 0h5.25", "M9 14.25l3 3 3-3")
);

export const IconListBullet = mk(
  sfListBullet,
  s(
    "M8.25 6.75h12M8.25 12h12m-12 5.25h12",
    "M4.5 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zm0 5.25a.75.75 0 110-1.5.75.75 0 010 1.5zm0 5.25a.75.75 0 110-1.5.75.75 0 010 1.5z"
  )
);

export const IconListNumber = mk(
  sfListNumber,
  s(
    "M8.242 5.992h12m-12 6.003H20.24m-12 5.999h12",
    "M4.5 3.75h.375a.375.375 0 01.375.375V6h-.75M4.5 6H3.75m.75 0h.375a.375.375 0 010 .75h-.75M3.75 9h.75v1.5H3.75V9zm0 4.5h.375a.375.375 0 01.375.375V15h-.75m0 0h-.375m.375 0H4.5m-.75 0h.375"
  )
);

export const IconMagnifyingglass = mk(
  sfMagnifyingglass,
  s(
    "M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
  )
);

export const IconMicrophoneFill = mk(
  sfMicrophoneFill,
  s(
    "M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
  )
);

export const IconPauseFill = mk(
  sfPauseFill,
  f(
    "M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z"
  )
);

export const IconPlayFill = mk(
  sfPlayFill,
  f(
    "M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
  )
);

export const IconPlus = mk(sfPlus, s("M12 4.5v15m7.5-7.5h-15"));

export const IconPlusCircle = mk(
  sfPlusCircle,
  s("M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z")
);

export const IconRectangleStack = mk(
  sfRectangleStack,
  s(
    "M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-.98.626-1.813 1.5-2.122"
  )
);

export const IconSidebarLeft = mk(
  sfSidebarLeft,
  s("M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12", "M9 3.75v16.5")
);

export const IconStopFill = mk(
  sfStopFill,
  f(
    "M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z"
  )
);

export const IconStrikethrough = mk(
  sfStrikethrough,
  t("S̶", { textDecoration: "line-through" })
);

export const IconTextDocument = mk(
  sfTextDocument,
  s(
    "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12",
    "M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
  )
);

export const IconTextformat = mk(sfTextformat, t("T", { fontWeight: "500" }));

export const IconTextRectanglePage = mk(
  sfTextRectanglePage,
  s(
    "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5-3H12",
    "M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
  )
);

export const IconTrash = mk(
  sfTrash,
  s(
    "M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
  )
);

export const IconWaveform = mk(sfWaveform, s("M9 19V6l2 5h2l2-5 2 5v8"));

export const IconXCircle = mk(
  sfXCircle,
  s("M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z")
);

export const IconXmark = mk(sfXmark, s("M6 18L18 6M6 6l12 12"));
