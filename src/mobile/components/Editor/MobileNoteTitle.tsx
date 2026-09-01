/**
 * MobileNoteTitle.tsx
 *
 * Titre de l'éditeur mobile — jusqu'à 2 lignes, tronqué (ellipsis) au repos.
 * Le chevron à gauche déplie le titre en entier ET révèle les propriétés
 * (état porté par le parent, cf. NoteEditor : propertiesExpanded).
 *
 * Morph vers la zone titre de la barre flottante (scrollCollapseProgress,
 * piloté par MobileEditor) : le titre en flux est masqué dès qu'on quitte le
 * repos (progress > 0) et remplacé par un overlay `position: fixed` (portal)
 * dont la position/taille/taille de police interpolent, image par image,
 * entre le rect mesuré du titre au repos et le rect (déterministe, cf.
 * constantes FloatingHeaderBar) du slot central de la barre — un seul titre
 * visible à la fois, jamais de double affichage/fantôme pendant la transition.
 * Pas de fond pill (texte nu sur le dégradé de MobileEditor) : le portail vise
 * un conteneur fourni par MobileEditor (pas document.body) pour rester dans le
 * même sous-arbre transformé que le reste de l'éditeur — sinon il ignore le
 * translateX du swipe retour et reste figé à l'écran pendant la transition.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import type { EditorRef } from "../../../shared/components/NoteEditor/lib/editorCommands";
import { editorFocusAtStart } from "../../../shared/components/NoteEditor/lib/editorCommands";
import { IconChevronDown } from "../../../shared/components/PlatformIcon";
import { hapticImpact } from "../../lib/haptics";
import {
  FLOATING_HEADER_CONTENT_HEIGHT,
  FLOATING_HEADER_SIDE_INSET,
  FLOATING_HEADER_SLOT_GAP,
  FLOATING_HEADER_SLOT_SIZE,
  FLOATING_HEADER_TOP_OFFSET,
  TITLE_COLLAPSE_RANGE,
  TITLE_COLLAPSE_START,
} from "../Floating/FloatingHeaderBar";

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Métriques du titre au repos (text-2xl leading-snug) et de son état final
// dans la pill — point de départ/arrivée de l'interpolation de taille de
// police pendant le morph.
const TITLE_FONT_SIZE = 24;
const TITLE_LINE_HEIGHT = 33;
const PILL_FONT_SIZE = 14;
// Marge texte↔bord de la pill, interpolée depuis le px-1 (4px) du titre réel
// pour ne pas créer de saut au tout début du morph.
const TITLE_TEXT_INSET = 4;
const PILL_TEXT_INSET = 12;

// Mesure hors-DOM (canvas) de la largeur naturelle du titre à la taille de
// police de la pill — sert à faire migrer la boîte du morph vers une largeur
// "ajustée au texte" centrée dans le slot, plutôt que de garder la pleine
// largeur du slot en alignement gauche (text-align n'est pas interpolable en
// continu, donc pas d'autre façon de finir centré sans à-coup).
let measureCanvas: HTMLCanvasElement | null = null;
function measureTextWidth(text: string, font: string): number {
  measureCanvas ??= document.createElement("canvas");
  const ctx = measureCanvas.getContext("2d");
  if (!ctx) return 0;
  ctx.font = font;
  return ctx.measureText(text).width;
}

interface Props {
  name: string;
  onRename: (newName: string) => Promise<void>;
  editorRef: EditorRef;
  expanded: boolean;
  onToggleExpanded: () => void;
  /** Progression (0-1) du fondu vers la barre flottante — pilotée par le scroll du parent. */
  scrollCollapseProgress: number;
  /** Conteneur du portail de morph (racine de MobileEditor) — pour rester dans
   * le sous-arbre transformé pendant le swipe retour. À défaut, document.body. */
  portalContainer?: React.RefObject<HTMLElement | null>;
}

export function MobileNoteTitle({
  name,
  onRename,
  editorRef,
  expanded,
  onToggleExpanded,
  scrollCollapseProgress,
  portalContainer,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLButtonElement>(null);
  // Largeur naturelle du titre à la taille de police finale (pill) — ne dépend
  // que du texte, recalculée seulement si le titre change (pas à chaque frame).
  const pillNaturalWidth = useMemo(() => {
    const fontFamily =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--font-header")
        .trim() || "serif";
    return measureTextWidth(name, `600 ${PILL_FONT_SIZE}px ${fontFamily}`);
  }, [name]);
  // Ref toujours à jour — permet au cleanup de lire les valeurs courantes
  const stateRef = useRef({ isEditing, editValue, name, onRename });
  stateRef.current = { isEditing, editValue, name, onRename };

  // Swipe arrière démonte le composant sans déclencher onBlur : on flush le
  // rename en attente au démontage (même contournement que EditableText).
  useEffect(() => {
    return () => {
      const {
        isEditing: editing,
        editValue: val,
        name: orig,
        onRename: save,
      } = stateRef.current;
      if (!editing) return;
      const trimmed = val.trim();
      if (trimmed && trimmed !== orig) save(trimmed).catch(() => {});
    };
  }, []);

  async function handleSave() {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === name) {
      setEditValue(name);
      setIsEditing(false);
      return;
    }
    try {
      await onRename(trimmed);
      setIsEditing(false);
    } catch {
      setEditValue(name);
      setIsEditing(false);
    }
  }

  function startEditing() {
    setEditValue(name);
    // iOS n'ouvre le clavier que si focus() a lieu dans le même tick que le
    // geste utilisateur : on force le rendu du textarea avant de le focus.
    flushSync(() => setIsEditing(true));
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
    // Replié (2 lignes max, cf. effet d'auto-hauteur ci-dessous) : le curseur
    // est en fin de texte mais la zone reste scrollée en haut par défaut — on
    // pousse explicitement en bas pour que l'édition parte visible, sinon on
    // ne voit pas ce qu'on écrit.
    el.scrollTop = el.scrollHeight;
  }

  // Auto-hauteur du textarea d'édition : 1 ligne par défaut, ne grandit que si
  // le texte dépasse réellement (pas de rows=2 fixe, qui décalait le chevron
  // même pour un titre court). Repliée : plafonnée à 2 lignes (comme l'affichage
  // line-clamp-2), le reste défile — dépliée : pas de plafond, croît librement.
  // biome-ignore lint/correctness/useExhaustiveDependencies: editValue pilote el.value (contrôlé) donc el.scrollHeight — pas lu directement dans le corps, mais l'effet doit se relancer à chaque frappe.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!isEditing || !el) return;
    el.style.height = "auto";
    const maxHeight = expanded
      ? Number.POSITIVE_INFINITY
      : TITLE_LINE_HEIGHT * 2;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [isEditing, editValue, expanded]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter") {
      // Le titre reste une seule "ligne logique" — le wrap sur 2 lignes n'est
      // que visuel. Entrée bascule dans le corps plutôt que d'insérer un saut.
      e.preventDefault();
      textareaRef.current?.blur();
      editorFocusAtStart(editorRef);
    } else if (e.key === "Escape") {
      setEditValue(name);
      setIsEditing(false);
    }
  }

  // Overlay de morph : dès qu'on quitte le repos, on masque le titre en flux
  // (opacité binaire, pas de transition — le handoff doit être invisible) et
  // on calcule la position d'un overlay fixed qui migre vers le slot central
  // de la barre. Calcul fait au rendu (pas en useEffect) pour rester dans la
  // même frame que le scroll, sans retard d'un cycle de re-render.
  let morphOverlay: React.ReactNode = null;
  if (!isEditing && scrollCollapseProgress > 0 && titleRef.current) {
    const rect = titleRef.current.getBoundingClientRect();
    // scrollTop reconstruit depuis la progression : exact tant que
    // 0 < progress < 1 (au-delà, MobileEditor clampe et on n'a de toute façon
    // plus besoin du rect de départ — lerp(_, end, 1) = end).
    const scrollTopNow =
      TITLE_COLLAPSE_START + scrollCollapseProgress * TITLE_COLLAPSE_RANGE;
    const restLeft = rect.left;
    const restTop = rect.top + scrollTopNow;
    const restWidth = rect.width;

    const slotLeft =
      FLOATING_HEADER_SIDE_INSET +
      FLOATING_HEADER_SLOT_SIZE +
      FLOATING_HEADER_SLOT_GAP;
    const slotWidth = window.innerWidth - slotLeft * 2;
    // Boîte finale ajustée au texte + marge (pas la pleine largeur du slot) et
    // centrée dedans — texte toujours aligné à gauche dans sa boîte
    // (interpolable), mais la boîte elle-même finit centrée puisqu'elle épouse
    // le texte plutôt que de rester à la largeur fixe du slot.
    const endTextWidth = Math.min(
      pillNaturalWidth,
      slotWidth - PILL_TEXT_INSET * 2
    );
    const endWidth = endTextWidth + PILL_TEXT_INSET * 2;
    const endLeft = slotLeft + (slotWidth - endWidth) / 2;
    const t = scrollCollapseProgress;
    const textInset = lerp(TITLE_TEXT_INSET, PILL_TEXT_INSET, t);

    morphOverlay = createPortal(
      <div
        className="fixed pointer-events-none z-40"
        style={{
          left: lerp(restLeft, endLeft, t),
          top: lerp(restTop, FLOATING_HEADER_TOP_OFFSET, t),
          width: lerp(restWidth, endWidth, t),
          height: lerp(TITLE_LINE_HEIGHT, FLOATING_HEADER_CONTENT_HEIGHT, t),
        }}
      >
        <div
          className="relative w-full h-full flex items-center font-header font-semibold text-gray-900"
          style={{
            paddingLeft: textInset,
            paddingRight: textInset,
            fontSize: lerp(TITLE_FONT_SIZE, PILL_FONT_SIZE, t),
          }}
        >
          {/* text-overflow ne s'applique qu'à un conteneur block — inutile sur le
              flex parent (cf. bug ellipsis silencieusement ignorée). */}
          <span className="block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
            {name}
          </span>
        </div>
      </div>,
      portalContainer?.current ?? document.body
    );
  }

  return (
    <>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          // pointerdown/preventDefault + action au pointerup, comme le reste des
          // boutons de la barre d'édition (cf. MobileFormattingBar) : un simple
          // onClick perd son premier tap quand il retire le focus d'un champ
          // encore actif (le clavier se ferme sans déclencher le click).
          onPointerDown={(e) => e.preventDefault()}
          onPointerUp={() => {
            hapticImpact("light");
            onToggleExpanded();
          }}
          // Largeur alignée sur la boîte size-13 du chevron retour de la barre
          // flottante (cf. FloatingHeaderBar) — même inset (px-3) côté parent.
          // Fondu/rétrécissement liés au scroll sur le bouton (pas de transition,
          // synchrone au doigt) ; la rotation d'ouverture reste sur le span
          // interne avec sa propre transition — deux transforms indépendants.
          className="shrink-0 w-13 h-8 flex items-center justify-center rounded-full text-gray-400 active:bg-gray-100"
          style={{
            opacity: 1 - scrollCollapseProgress,
            transform: `scale(${1 - 0.15 * scrollCollapseProgress}) translateY(${-6 * scrollCollapseProgress}px)`,
          }}
          aria-label={
            expanded
              ? "Réduire le titre"
              : "Développer le titre et les propriétés"
          }
        >
          <span
            className="inline-flex transition-transform duration-200"
            style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
          >
            <IconChevronDown className="size-4" />
          </span>
        </button>

        {isEditing ? (
          <textarea
            ref={textareaRef}
            rows={1}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            enterKeyHint="done"
            className={`flex-1 min-w-0 outline-none caret-amber-400 resize-none break-words font-header text-2xl leading-snug px-1 py-0.5 ${
              expanded ? "overflow-y-hidden" : "overflow-y-auto"
            }`}
          />
        ) : (
          <button
            ref={titleRef}
            type="button"
            onClick={startEditing}
            style={{ opacity: scrollCollapseProgress > 0 ? 0 : 1 }}
            className="flex-1 min-w-0 text-left px-1 py-0.5"
          >
            {/* -webkit-line-clamp est sans effet sur un <button> (élément de
                formulaire) dans WebKit — le clamp doit porter sur un enfant.
                Pas de classe "block" à côté : line-clamp-2 pose lui-même
                display:-webkit-box, et un autre utilitaire de display sur le
                même élément entre en conflit de cascade (qui l'emporte n'est
                pas garanti par l'ordre dans le className). */}
            <span
              className={`font-header text-2xl leading-snug break-words ${
                expanded ? "" : "line-clamp-2"
              }`}
            >
              {name}
            </span>
          </button>
        )}
      </div>
      {morphOverlay}
    </>
  );
}
