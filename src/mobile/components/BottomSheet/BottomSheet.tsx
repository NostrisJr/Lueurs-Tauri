/**
 * BottomSheet — modal slide-up clavier-aware.
 *
 * Positionnement :
 *   - Sans clavier : bottom=0, height=45vh → le bas du sheet est au ras de l'écran
 *   - Avec clavier  : bottom=keyboardHeight, height ≤ zone visible − marge
 *     → le sheet se pose juste au-dessus du clavier
 *
 * Les coins bas sont droits : le clavier (ou le bas de l'écran) forme visuellement
 * la base du sheet, les coins bas ne sont jamais visibles.
 * Coins haut en squircle (superellipse iOS via notre composant Squircle).
 *
 * Monté dans un Portal (document.body) pour échapper aux overflow:hidden parents.
 * Swipe vers le bas pour fermer.
 */
import { useSetAtom } from "jotai";
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Squircle } from "../../../shared/components/Squircle";
import { mobileOpenSheetCountAtom } from "../../../shared/lib/atoms";
import { useKeyboard } from "../../hooks/useKeyboard";

// Durée de l'animation de sortie (doit matcher la transition transform ci-dessous)
const EXIT_DURATION_MS = 300;

// Doit rester synchro avec les classes du drag handle ci-dessous
// (mt-3 + h-1 + mb-2 = 12 + 4 + 8) — mesuré séparément du contenu (cf.
// autoHeight) car pas dans contentRef.
const DRAG_HANDLE_HEIGHT = 24;

interface Props {
  onClose: () => void;
  children: ReactNode;
  title?: string;
  /** Fraction de la hauteur du viewport utilisée (sans clavier). Défaut : 0.45.
   * Ignoré si `autoHeight` est actif. */
  heightFraction?: number;
  /** Hauteur ajustée au contenu réel (mesuré via ResizeObserver) plutôt qu'une
   * fraction fixe de l'écran — pour un contenu compact (ex: recherche) où une
   * fraction fixe laisserait un vide inutile. Prime sur heightFraction, y
   * compris clavier ouvert. Ne prend pas en compte `title` dans la mesure
   * (non utilisé par les appelants actuels de autoHeight). */
  autoHeight?: boolean;
  /** false pour ne pas assombrir ce qu'il y a derrière (ex: recherche, où on
   * veut voir le texte/les surlignages du document pendant que la sheet est
   * ouverte) — la zone de fermeture au tap reste présente, juste invisible.
   * Défaut true. */
  dimBackground?: boolean;
  /** Appelé avec le nombre de pixels occupés en bas de l'écran par la sheet
   * (clavier + hauteur de la sheet elle-même) à chaque changement — pour un
   * appelant qui doit garder du contenu visible au-dessus (ex: MobileSearchBar,
   * qui recale son scroll-to-match dessus puisque la hauteur varie avec le
   * clavier et le contenu en autoHeight). */
  onHeightChange?: (bottomObstructionPx: number) => void;
}

export function BottomSheet({
  onClose,
  children,
  title,
  heightFraction = 0.45,
  autoHeight = false,
  dimBackground = true,
  onHeightChange,
}: Props) {
  const { height: keyboardHeight, isOpen: isKeyboardOpen } = useKeyboard();
  const startYRef = useRef(0);
  const swipeAllowedRef = useRef(true);
  const [swipe, setSwipe] = useState(0);

  // N'active le scroll (et le momentum iOS) que si le contenu dépasse
  // réellement la hauteur disponible, sinon iOS autorise un léger rubber-band
  // même sans overflow.
  const contentRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);
  // autoHeight : hauteur mesurée du contenu (scrollHeight de contentRef,
  // padding-bottom inclus puisqu'il porte sur cet élément) — indépendante de
  // canScroll ci-dessous, qui compare au clientHeight déjà contraint par
  // sheetH (donc circulaire si utilisé pour dériver sheetH lui-même).
  const [measuredContentHeight, setMeasuredContentHeight] = useState<
    number | null
  >(null);

  // Monté fermé (hors écran) puis ouvert une frame plus tard, pour que la transition
  // CSS ait deux états distincts à interpoler (sinon le sheet apparaît déjà en place).
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== undefined) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const container = contentRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;
    const check = () =>
      setCanScroll(inner.scrollHeight > container.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(container);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  // useLayoutEffect (pas useEffect) : mesure avant peinture, sinon la sheet
  // s'ouvre un instant à la hauteur "fraction" par défaut puis rétrécit
  // visiblement dès que la mesure arrive — un flash indésirable pour un
  // contenu censé être minimal dès le premier rendu.
  useLayoutEffect(() => {
    if (!autoHeight) return;
    // Mesure sur innerRef, pas contentRef : contentRef est flex-1, donc sa
    // propre hauteur dépend déjà de sheetH (celle qu'on calcule à partir de
    // cette mesure) — circulaire, et scrollHeight d'un flex-1 sans overflow
    // vaut son clientHeight (la hauteur imposée), pas la hauteur naturelle du
    // contenu. innerRef est un div normal, sa hauteur reste toujours celle du
    // contenu réel.
    const inner = innerRef.current;
    if (!inner) return;
    const measure = () => setMeasuredContentHeight(inner.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [autoHeight]);

  // Fermeture "gestuelle" (overlay/swipe) : joue l'animation de sortie avant
  // de démonter réellement via onClose.
  function requestClose() {
    if (closing) return;
    setClosing(true);
    closeTimeoutRef.current = window.setTimeout(onClose, EXIT_DURATION_MS);
  }

  // Compte cette sheet dans mobileOpenSheetCountAtom tant qu'elle est montée
  // — MobileApp désactive le swipe-back/-avant tant que ce compte est non nul
  // (cf. commentaire sur l'atome), plutôt que de tenter de la refermer au
  // geste.
  const setOpenSheetCount = useSetAtom(mobileOpenSheetCountAtom);
  useEffect(() => {
    setOpenSheetCount((n) => n + 1);
    return () => setOpenSheetCount((n) => n - 1);
  }, [setOpenSheetCount]);

  // Hauteur disponible au-dessus du clavier (ou de l'écran entier)
  const visibleH = window.innerHeight - keyboardHeight;
  // heightFraction reste calculé sur la hauteur PLEINE (pas visibleH) même
  // clavier ouvert — juste clampé pour ne jamais dépasser l'espace visible
  // au-dessus du clavier : l'ancien palier fixe à 85% de visibleH ignorait la
  // préférence de l'appelant (ex: InlineFormulaPopup, heightFraction=0.4,
  // pensé compact) et faisait bondir la sheet à une hauteur bien plus grande
  // que son contenu dès que le clavier s'ouvrait.
  const sheetH =
    autoHeight && measuredContentHeight != null
      ? Math.min(measuredContentHeight + DRAG_HANDLE_HEIGHT, visibleH - 40)
      : Math.min(
          Math.round(window.innerHeight * heightFraction),
          visibleH - 40
        );
  const translateY = closing || !entered ? "100%" : `${swipe}px`;

  useEffect(() => {
    onHeightChange?.(keyboardHeight + sheetH);
  }, [keyboardHeight, sheetH, onHeightChange]);

  const sheet = (
    // stopPropagation : évite que le tap sur l'overlay remonte dans l'arbre React
    // vers un BottomSheet parent (ex: NoteSelector au-dessus du BottomSheet formule).
    // biome-ignore lint/a11y/useKeyWithClickEvents: overlay tactile
    <div
      className={`fixed inset-0 z-50 ${dimBackground ? "bg-gray-600/30" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        requestClose();
      }}
    >
      <div
        className="fixed left-0 right-0"
        style={{
          bottom: keyboardHeight,
          height: sheetH,
          transform: `translateY(${translateY})`,
          transition:
            swipe === 0
              ? "bottom 0.3s ease-out, height 0.3s ease-out, transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)"
              : undefined,
        }}
      >
        {/* Couche d'ombre séparée, non clippée : box-shadow (pas filter:
            drop-shadow) car Squircle applique son clip-path sur son propre
            élément — combiné à drop-shadow sur ce même élément, l'ombre serait
            elle aussi rognée par le clip-path (même contournement que
            SearchBar.tsx desktop). rounded-t plutôt que la vraie forme
            squircle : invisible vu le flou. Sans dimBackground, rien d'autre
            ne détache visuellement la sheet de la page (même fond blanc) —
            ombre plus marquée pour compenser, et surtout vers le haut (dy < 0)
            puisque le bas colle à l'écran/au clavier.  */}
        <div
          className="absolute inset-0 rounded-t-[28px] pointer-events-none"
          style={{
            boxShadow: dimBackground
              ? "0px -4px 20px rgba(0,0,0,0.12)"
              : "0px -8px 28px rgba(0,0,0,0.28)",
          }}
        />
        <Squircle
          topRadius={28}
          className="absolute inset-0 bg-white flex flex-col"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          onTouchStart={(e: React.TouchEvent) => {
            // Empêche un geste démarré dans UNE sheet imbriquée (ex: le
            // sélecteur de couleur ouvert depuis les options Bouton) de
            // remonter (bubbling fiber, à travers le portail) jusqu'aux
            // handlers tactiles d'une sheet ANCÊTRE — sans ça, un seul swipe
            // sur la sheet enfant était aussi interprété comme un swipe-to-
            // close par la sheet parente, fermant les deux à la fois.
            e.stopPropagation();
            startYRef.current = e.touches[0].clientY;
            // Le swipe-to-close ne doit s'engager que si le contenu est déjà
            // scrollé en haut, sinon il vole le geste de scroll interne (ex:
            // remonter dans la liste d'emojis) et referme la sheet par erreur.
            swipeAllowedRef.current = (contentRef.current?.scrollTop ?? 0) <= 0;
          }}
          onTouchMove={(e: React.TouchEvent) => {
            e.stopPropagation();
            if (!swipeAllowedRef.current) return;
            const dy = e.touches[0].clientY - startYRef.current;
            // Seuil 10px avant tout effet : en dessous, on considère que le
            // doigt tape (pas de swipe). Sous ce seuil, même un setSwipe(dy)
            // anodin redessine le sheet (translateY change) pendant le tap et
            // peut faire annuler par iOS le click synthétisé sous le doigt —
            // d'où le besoin d'un appui plus ferme/long pour valider un tap
            // (ex: sélection d'emoji) avant ce fix.
            if (dy > 10) {
              setSwipe(dy);
              e.preventDefault();
            }
          }}
          onTouchEnd={(e: React.TouchEvent) => {
            e.stopPropagation();
            if (swipe > 60) {
              setSwipe(0);
              requestClose();
            } else {
              setSwipe(0);
            }
          }}
        >
          {/* Drag handle */}
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-2 shrink-0" />
          {title && (
            <p className="px-4 pb-2 text-sm text-gray-400 uppercase tracking-wide shrink-0">
              {title}
            </p>
          )}
          <div
            ref={contentRef}
            className="flex-1"
            data-scrollable
            style={{
              overflowY: canScroll ? "auto" : "hidden",
              WebkitOverflowScrolling: canScroll ? "touch" : undefined,
              paddingBottom: isKeyboardOpen
                ? "4px"
                : "calc(env(safe-area-inset-bottom) + 4px)",
            }}
          >
            <div ref={innerRef}>{children}</div>
          </div>
        </Squircle>
      </div>
      {/* iOS 26 : le clavier système a des coins hauts arrondis qui laissent
          voir la WebView en dessous (pas une couleur système fixe) — sans ce
          calque, l'ombre du sheet (ou le fond assombri) débordait dans ces
          coins et y créait une tache grise sur le clavier noir. On peint du
          blanc (couleur du Squircle) sur toute la hauteur du clavier : invisible
          partout où le clavier est opaque, visible seulement dans ses coins
          découpés — pas besoin de connaître leur rayon exact. Placé après (donc
          au-dessus de) l'ombre et l'overlay d'assombrissement pour rester
          blanc pur. keyboardHeight = 0 clavier fermé → calque nul. */}
      <div
        className="fixed left-0 right-0 bottom-0 bg-white pointer-events-none"
        style={{ height: keyboardHeight }}
      />
    </div>
  );

  return createPortal(sheet, document.body);
}
