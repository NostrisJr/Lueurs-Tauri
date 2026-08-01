import { useDrag } from "@use-gesture/react";
import { useEffect, useRef, useState } from "react";
import { IconTrash } from "../../../shared/components/PlatformIcon";
import { hapticImpact } from "../../lib/haptics";
import { startMomentumScroll } from "../../lib/momentumScroll";
import { RowContextMenu } from "./RowContextMenu";
import type { RowMenuConfig } from "./types";

const BTN = 40; // hauteur (et diamètre au repos) du bouton révélé par le swipe
const PAD_R = 10; // marge droite du bouton
const BTN_GAP = 14; // espace fixe entre le bord de la rangée et le bouton
// Au-delà de cette largeur, le bouton cesse de s'étirer et se recentre plutôt
// dans l'espace laissé par le swipe (2 à 3 fois sa hauteur, comme demandé).
const BTN_MAX_W = BTN * 2.5;
// Suppression en une seule étape : décidée uniquement par la distance parcourue
// (proportion de la largeur de la rangée), jamais par la vitesse — un swipe lent
// qui dépasse le seuil supprime tout autant qu'un flick rapide.
const DELETE_RATIO = 0.3;
// Reswiper depuis la position ouverte (au repos) demande beaucoup moins de
// distance : le doigt repart d'un geste neuf, pas besoin de retraverser tout
// le seuil du premier swipe.
const REOPEN_DELETE_RATIO = 0.15;
// Marge de résistance élastique au-delà du seuil de suppression.
const RUBBERBAND_MARGIN = 60;
// Largeur du bouton (proportion de la rangée) pendant l'animation de
// suppression : il grandit et « chasse » la rangée hors de l'écran, sans
// jamais viser la pleine largeur.
const CLOSING_BTN_RATIO = 0.5;
// Décalage additionnel (au-delà de sa croissance en largeur) au moment de la
// disparition : un vrai mouvement de fuite vers la gauche, pas un fondu figé.
const CLOSING_SLIDE_PX = 60;
// En dessous, un mouvement est ignoré (tap) ou laissé au scroll natif vertical.
const DIRECTION_LOCK_PX = 6;
// Un seul mouvement : la rangée glisse et s'efface en même temps que la hauteur
// se réduit, sans pause entre les deux (pas de slideOut → collapse).
const CLOSE_DURATION_MS = 260;
// Durée d'appui avant l'ouverture du menu contextuel — le standard iOS.
const LONG_PRESS_MS = 500;
// Rayon de tolérance pendant l'attente du long-press : en dessous, le geste
// n'est ni un scroll ni un swipe, seulement la main qui tremble sur un doigt
// posé. Aligné sur les 10 pt d'UIKit — il n'a plus à compenser le démarrage
// tardif de use-gesture, l'appui long partant désormais du pointerdown.
// À mesurer depuis le franchissement du seuil interne de use-gesture (3 px),
// la tolérance réelle du doigt est donc d'environ 13 px.
const HOLD_JITTER_PX = 10;
// Une fois le menu ouvert, distance à partir de laquelle le doigt fait passer
// l'aperçu en déplacement. Doit rester ≤ HOLD_JITTER_PX, sinon un mouvement
// suffisant pour détacher l'aperçu aurait déjà annulé l'appui long avant que
// le menu n'ait eu le temps de s'ouvrir.
const DRAG_START_PX = 8;

type Phase = "idle" | "held" | "open" | "dragging";

interface Props {
  children: React.ReactNode;
  /** Suppression effective — appelée après l'animation de fermeture (comme un
   * item de liste "optimiste" : on anime d'abord, la donnée disparaît ensuite),
   * donc jamais de dialogue de confirmation ici. Utiliser `confirmDelete` pour ça. */
  onDelete: () => void;
  /** Étape de confirmation, appelée AVANT toute animation (ex: dialogue "dossier
   * non vide ?"). Résoudre `false` annule : la rangée revient à l'état ouvert
   * sans jouer l'animation de suppression. Omis = pas de confirmation requise. */
  confirmDelete?: () => Promise<boolean>;
  icon?: React.FC<{ className?: string }>;
  /** Menu contextuel au long press (aperçu soulevé + actions). Omis = pas de long press. */
  menu?: RowMenuConfig;
  /** Tap sur l'aperçu soulevé — même effet qu'un tap sur la rangée elle-même. */
  onActivate?: () => void;
  /** Autorise le passage de l'aperçu au déplacement (drag & drop). */
  dragEnabled?: boolean;
  onDragStart?: () => void;
  onDragMove?: (clientX: number, clientY: number) => void;
  onDragEnd?: (clientX: number, clientY: number) => void;
  onDragCancel?: () => void;
}

/**
 * Arbitre unique des gestes d'une rangée de liste mobile.
 *
 *   swipe horizontal      → bouton de suppression, puis suppression franche
 *   appui long (500 ms)   → menu contextuel iOS (aperçu soulevé + actions)
 *   …puis mouvement       → l'aperçu devient le ghost de déplacement
 *   …puis doigt relevé    → le menu reste ouvert et interactif
 *
 * Les trois issues sont mutuellement exclusives et décidées par ce seul
 * `useDrag` : deux gestionnaires concurrents sur la même rangée (un pour le
 * swipe, un pour l'appui long) se volent le geste — c'est précisément ce que
 * faisait l'implémentation précédente.
 */
export function MobileRowGestures({
  children,
  onDelete,
  confirmDelete,
  icon: Icon = IconTrash,
  menu,
  onActivate,
  dragEnabled = false,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
}: Props) {
  // Position d'ouverture au repos : juste assez pour le bouton à sa taille
  // minimale, plus son espace fixe avec la rangée.
  const revealWidth = PAD_R + BTN_GAP + BTN;

  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [closing, setClosing] = useState(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(
    null
  );

  const rowRef = useRef<HTMLDivElement>(null);
  // Distance (absolue, en px) à laquelle a démarré le geste en cours — capturée
  // une fois au premier événement (cf. le `bind` plus bas) : permet de savoir
  // si ce swipe repart de fermé (0) ou déjà ouvert (-revealWidth), pour choisir
  // le bon seuil de suppression.
  const gestureStartOffsetRef = useRef(0);
  // Recalculé à chaque render à partir de la largeur réelle de la rangée
  // (fallback écran tant qu'elle n'est pas encore montée) : les seuils suivent
  // la largeur de la liste, pas un nombre de pixels fixe.
  const rowWidth = rowRef.current?.offsetWidth ?? window.innerWidth;
  const deleteThreshold = rowWidth * DELETE_RATIO;
  const reopenDeleteThreshold = rowWidth * REOPEN_DELETE_RATIO;
  // Conteneur scrollable ancêtre (cf. data-mobile-scroll-container posé par
  // MobileFileTree) — résolu au pointerdown, utilisé pour le scroll manuel
  // pendant la phase idle des rangées avec `dragEnabled` (cf. plus bas).
  const scrollElRef = useRef<HTMLElement | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Le state React n'est pas lu à temps dans le handler de geste (qui tourne
  // plusieurs fois par frame) : la phase courante est tenue par un ref.
  const phaseRef = useRef<Phase>("idle");
  // Une fois un swipe horizontal confirmé, le hold-timer ne doit plus jamais
  // ouvrir le menu (les deux gestes sont mutuellement exclusifs).
  const swipeConfirmedRef = useRef(false);
  // L'appui long synthétise un click natif au relâchement — sans ce garde-fou,
  // il rouvrirait la note juste après la fermeture du menu.
  const suppressClickRef = useRef(false);

  function setPhaseNow(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
  }

  // La confirmation (dialogue) se résout AVANT toute animation — sinon la
  // rangée disparaîtrait visuellement avant même l'affichage du dialogue
  // "dossier non vide", et "reviendrait" si annulé, donnant l'impression que la
  // suppression ne fonctionne pas. Une fois confirmé (ou d'emblée si pas de
  // confirmation requise), on retrouve le pattern optimiste habituel : animer
  // d'abord, supprimer la donnée ensuite.
  async function triggerClose() {
    if (confirmDelete) {
      const confirmed = await confirmDelete();
      if (!confirmed) {
        setOffsetX(-revealWidth);
        return;
      }
    }
    hapticImpact("medium");
    setClosing(true);
    setTimeout(onDelete, CLOSE_DURATION_MS);
  }

  useEffect(() => () => clearHoldTimer(), []);

  function clearHoldTimer() {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }

  // L'appui long est armé sur un vrai `pointerdown`, et non depuis le handler de
  // `useDrag` : avec `filterTaps` (indispensable, c'est lui qui installe la
  // suppression du click après un swipe), use-gesture n'émet son premier
  // événement qu'une fois 3 px franchis. Un doigt parfaitement immobile ne
  // déclenchait donc jamais rien, et il fallait "presser" l'écran pour que le
  // barycentre du contact bouge assez — d'où un appui long qui semblait exiger
  // de la force et ne partait qu'une fois sur deux.
  function handlePointerDown(e: React.PointerEvent) {
    swipeConfirmedRef.current = false;
    suppressClickRef.current = false;
    clearHoldTimer();
    // Le bouton de suppression révélé par le swipe partage ce conteneur : un
    // appui dessus ne doit pas armer le menu de la rangée.
    if (!rowRef.current?.contains(e.target as Node)) return;
    scrollElRef.current = rowRef.current.closest<HTMLElement>(
      "[data-mobile-scroll-container]"
    );
    if (!menu || closing || phaseRef.current !== "idle") return;
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      if (swipeConfirmedRef.current) return;
      openMenu();
    }, LONG_PRESS_MS);
  }

  // Le passage "doigt encore posé" → "menu interactif" ne peut pas non plus
  // dépendre de use-gesture : si le doigt a dérivé de 1 ou 2 px pendant l'appui,
  // le geste n'est ni intentionnel (< 3 px de mouvement) ni un tap (distance
  // cumulée > 3 px), et aucun événement `last` n'est émis — la phase resterait
  // figée sur "held", menu affiché mais sourd à tout.
  function handlePointerUp() {
    clearHoldTimer();
    if (phaseRef.current === "held") setPhaseNow("open");
  }

  function openMenu() {
    const el = rowRef.current;
    if (!el) return;
    // "heavy" : c'est le retour qui apprend à l'utilisateur que l'appui long a
    // pris, avant même que l'aperçu ne se soit soulevé. Déclenché en premier,
    // sans attendre le rendu de l'overlay.
    hapticImpact("heavy");
    setMenuRect(el.getBoundingClientRect());
    suppressClickRef.current = true;
    setPhaseNow("held");
  }

  function closeMenu() {
    setPhaseNow("idle");
    setMenuRect(null);
    setDragPoint(null);
  }

  function beginDrag(x: number, y: number) {
    // "medium" : volontairement plus léger que l'ouverture du menu, pour que les
    // deux retours restent distinguables quand ils s'enchaînent (menu → drag).
    hapticImpact("medium");
    setPhaseNow("dragging");
    setDragPoint({ x, y });
    onDragStart?.();
    onDragMove?.(x, y);
  }

  function updateDrag(x: number, y: number) {
    setDragPoint({ x, y });
    onDragMove?.(x, y);
  }

  function finishDrag(x: number, y: number, canceled: boolean) {
    closeMenu();
    if (canceled) onDragCancel?.();
    else onDragEnd?.(x, y);
  }

  const bind = useDrag(
    (state) => {
      const {
        first,
        last,
        xy: [x, y],
        movement: [mx, my],
        offset: [ox],
        velocity: [, vy],
        direction: [, dirY],
        delta: [, dy],
        tap,
        canceled,
        cancel,
        event,
      } = state;

      // Position de départ de CE geste (0 si la rangée était fermée,
      // -revealWidth si elle était déjà ouverte) — décide plus bas quel seuil
      // de suppression s'applique.
      if (first) gestureStartOffsetRef.current = ox;

      // Menu ouvert (doigt relevé) : l'overlay a la main, la rangée ne réagit plus.
      if (phaseRef.current === "open") return;

      // Menu ouvert avec le doigt encore posé : soit il se lève (le menu devient
      // interactif), soit il glisse (l'aperçu se détache en déplacement).
      if (phaseRef.current === "held") {
        event?.preventDefault?.();
        if (last || canceled) {
          setPhaseNow("open");
          return;
        }
        if (dragEnabled && Math.hypot(mx, my) > DRAG_START_PX) {
          beginDrag(x, y);
        }
        return;
      }

      if (phaseRef.current === "dragging") {
        event?.preventDefault?.();
        if (last || canceled) finishDrag(x, y, canceled);
        else updateDrag(x, y);
        return;
      }

      // Le doigt s'est levé sans qu'aucune issue ne se soit engagée (petit
      // mouvement, ni tap ni swipe) : le timer encore armé ouvrirait un menu
      // sans doigt posé, bloqué en phase "held" — donc ni interactif ni
      // fermable, puisque plus aucun événement ne viendra le faire évoluer.
      if (last) clearHoldTimer();

      // Tap franc (use-gesture filtre déjà les micro-mouvements) : rien à faire,
      // le click natif du contenu (ouvrir la note) s'exécute normalement.
      if (tap) return;

      // Appui long en cours : tant que le doigt reste dans le rayon de
      // tolérance, aucune autre issue ne peut lui voler le geste. Au-delà,
      // l'intention est clairement un déplacement du doigt → on rend la main au
      // swipe / au scroll.
      if (holdTimerRef.current) {
        if (Math.hypot(mx, my) <= HOLD_JITTER_PX) return;
        clearHoldTimer();
      }

      // Mouvement vertical dominant avant tout swipe confirmé : c'est un scroll.
      if (
        !swipeConfirmedRef.current &&
        Math.abs(my) > Math.abs(mx) &&
        Math.abs(my) > DIRECTION_LOCK_PX
      ) {
        // Rangée sans drag-to-reorder : touchAction reste "pan-y", le scroll
        // natif s'en charge, on cède juste le geste.
        if (!dragEnabled) {
          cancel();
          return;
        }
        // Rangée avec drag-to-reorder : touchAction est "none" (cf. plus bas)
        // pour que le futur passage en drag ne puisse jamais être volé par un
        // scroll déjà engagé nativement — touch-action se fige au tout début
        // du toucher et ignore ensuite tout preventDefault (comportement du
        // moteur, pas un bug ici). Le scroll doit donc être entièrement
        // rejoué à la main tant qu'aucun appui long n'est en cours.
        event?.preventDefault?.();
        if (scrollElRef.current) {
          scrollElRef.current.scrollTop -= dy;
          // Doigt relevé : plus de scroll natif pour reprendre l'inertie derrière
          // nous (touchAction "none" l'a désactivée en même temps que le reste),
          // donc on la rejoue nous-mêmes à partir de la vitesse du relâchement.
          if (last) startMomentumScroll(scrollElRef.current, dirY * vy);
        }
        return;
      }

      if (Math.abs(mx) > DIRECTION_LOCK_PX) {
        if (!swipeConfirmedRef.current) {
          swipeConfirmedRef.current = true;
          clearHoldTimer();
          setIsDragging(true);
        }
        event?.preventDefault?.();
      }

      if (!swipeConfirmedRef.current) return;

      // `offset` (borné/rubberbandé par use-gesture), pas `movement` : ce
      // dernier repart de 0 à chaque nouveau geste, alors que la rangée peut
      // déjà être ouverte (-revealWidth) — l'utiliser aurait fait « perdre »
      // au doigt tout le trajet déjà parcouru avant ce nouveau geste, et donc
      // réduit d'autant la distance réellement swipable.
      const next = Math.min(0, ox);
      setOffsetX(next);

      if (last) {
        setIsDragging(false);
        // Reswiper depuis la position ouverte demande beaucoup moins de
        // distance (REOPEN_DELETE_RATIO) que le premier swipe depuis fermé
        // (DELETE_RATIO) : dans les deux cas, uniquement la distance parcourue
        // DANS CE GESTE compte, jamais la vitesse.
        const startedOpen = gestureStartOffsetRef.current < -(revealWidth / 2);
        const required = startedOpen ? reopenDeleteThreshold : deleteThreshold;
        if (next < gestureStartOffsetRef.current - required) {
          triggerClose();
        } else if (next < -(revealWidth / 2)) {
          hapticImpact("light");
          setOffsetX(-revealWidth);
        } else {
          setOffsetX(0);
        }
      }
    },
    {
      filterTaps: true,
      // Rubber-band au-delà des bornes : résistance élastique façon iOS plutôt
      // qu'un arrêt brutal. La zone libre va jusqu'à un peu après le seuil de
      // suppression (le plus grand des deux, pour rester valable qu'on parte
      // fermé ou déjà ouvert) : la résistance ne se fait sentir qu'une fois
      // franchi.
      rubberband: true,
      bounds: { left: -(deleteThreshold + RUBBERBAND_MARGIN), right: 0 },
      from: () => [offsetX, 0],
    }
  );

  // Bloque le click natif synthétisé après l'appui long, en capture pour
  // intercepter avant que la rangée enfant (ouverture de la note) ne le reçoive.
  function handleClickCapture(e: React.MouseEvent) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }

  const closeTransition = `${CLOSE_DURATION_MS}ms ease-in`;

  // Largeur du conteneur révélé (tout l'espace découvert par le swipe, moins la
  // marge droite) et largeur du bouton lui-même à l'intérieur : la même formule
  // sert au suivi 1:1 pendant le drag et à l'animation de retour en place, donc
  // le bouton s'étire toujours en phase avec la rangée, jamais par à-coups.
  const swiped = Math.max(0, -offsetX);
  // Espace disponible une fois la marge fixe avec la rangée réservée : au repos
  // (swiped == revealWidth) elle vaut exactement BTN, donc le bouton est un
  // cercle collé à droite ; au-delà, elle grandit et étire le bouton avec elle.
  const available = Math.max(0, swiped - PAD_R - BTN_GAP);
  // Pendant la suppression, même bouton (rond, jamais un simple rectangle qui
  // remplacerait sa forme) : il continue de grandir, jusqu'à la moitié de la
  // rangée, en « chassant » la rangée qui glisse hors de l'écran.
  const containerWidth = closing
    ? rowWidth * CLOSING_BTN_RATIO
    : Math.max(0, swiped - PAD_R);
  const buttonWidth = closing
    ? rowWidth * CLOSING_BTN_RATIO
    : Math.min(available, BTN_MAX_W);
  // Une fois la largeur max atteinte, le bouton cesse de suivre le bord droit
  // et se recentre plutôt dans l'espace laissé par le swipe.
  const overflowing = !closing && available > BTN_MAX_W;

  const revealTransition = closing
    ? `width ${closeTransition}`
    : isDragging
      ? "none"
      : "width 280ms cubic-bezier(0.25, 0.46, 0.45, 0.94)";

  // Hauteur intrinsèque de la rangée (indépendante du `maxHeight` animé de son
  // wrapper, cf. plus bas) : sert de hauteur fixe au bouton, pour qu'il ne
  // rétrécisse jamais avec elle pendant l'animation de suppression.
  const rowHeight = rowRef.current?.offsetHeight ?? BTN;

  return (
    // Les handlers de pointeur de l'appui long vivent sur ce conteneur, et non
    // sur la rangée : `bind()` y pose déjà ses propres `onPointerDown`/`Up`, que
    // des props homonymes écraseraient silencieusement (le spread perd toujours
    // face aux props qui le suivent). Les événements de la rangée remontent ici.
    // Ni arrondi ni `overflow-hidden` ici : ce conteneur ne doit jamais rogner
    // le bouton — seule la rangée, juste en dessous, a besoin d'être clippée
    // pour son collapse de hauteur.
    <div
      className="relative"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      // Filet de sécurité : si le nœud qui détient le pointer capture disparaît
      // (re-render de l'arbre pendant l'appui), aucun pointerup n'arrivera.
      onLostPointerCapture={handlePointerUp}
    >
      {/* Bouton révélé par le swipe : suit le bord droit tant qu'il tient dans
          BTN_MAX_W, puis se recentre dans l'espace laissé par le swipe. Hauteur
          fixe (rowHeight, pas h-full) : sinon, en phase "closing", il rétrécirait
          en même temps que le wrapper de la rangée ci-dessous et semblerait
          disparaître par le haut plutôt que par un fondu vers la gauche. */}
      <div
        className={`absolute top-0 flex items-center overflow-hidden ${
          !closing && overflowing ? "justify-center" : "justify-end"
        }`}
        style={{
          width: containerWidth,
          height: rowHeight,
          right: PAD_R,
          opacity: closing ? 0 : 1,
          transform: closing ? `translateX(-${CLOSING_SLIDE_PX}px)` : undefined,
          transition: closing
            ? `width ${closeTransition}, transform ${closeTransition}, opacity ${closeTransition}`
            : revealTransition,
        }}
      >
        <button
          type="button"
          onClick={triggerClose}
          className="shrink-0 h-10 rounded-full bg-red-500 flex items-center justify-center active:bg-red-600"
          style={{ width: buttonWidth, transition: revealTransition }}
          aria-label="Supprimer"
        >
          <Icon className="size-4.5 text-white shrink-0" />
        </button>
      </div>

      {/* Rangée glissante — seul ce wrapper collapse en hauteur (le bouton,
          au-dessus, n'en fait plus partie). */}
      <div
        className="overflow-hidden rounded-xl"
        style={
          closing
            ? {
                maxHeight: 0,
                transition: `max-height ${closeTransition}`,
                overflow: "hidden",
              }
            : { maxHeight: 120 }
        }
      >
        <div
          ref={rowRef}
          {...bind()}
          onClickCapture={handleClickCapture}
          style={{
            transform: closing
              ? "translateX(-110%)"
              : `translateX(${offsetX}px)`,
            transition: closing
              ? `transform ${closeTransition}`
              : isDragging
                ? "none"
                : "transform 280ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            // L'aperçu flottant prend le relais visuellement pendant le déplacement.
            opacity: phase === "dragging" ? 0.35 : 1,
            // "none" et non "pan-y" quand dragEnabled : touch-action se fige au
            // pointerdown pour toute la durée du toucher, donc le laisser
            // permissif sur le scroll vertical natif l'autoriserait à voler le
            // geste dès que le doigt bouge après l'ouverture du menu (l'appui
            // long puis le drag-to-reorder), même si le scroll n'a démarré qu'à
            // ce moment-là — un preventDefault ultérieur ne peut plus l'arrêter.
            // Le scroll normal (avant tout appui long) est alors entièrement
            // rejoué à la main, cf. le useDrag ci-dessus.
            touchAction: dragEnabled ? "none" : "pan-y",
            userSelect: "none",
            // Sinon WebKit déclenche son propre appui long (callout de sélection)
            // et coupe le flux de pointeurs au milieu du nôtre.
            WebkitTouchCallout: "none",
          }}
        >
          {children}
        </div>
      </div>

      {menu && menuRect && phase !== "idle" && (
        <RowContextMenu
          rect={menuRect}
          config={menu}
          phase={phase}
          dragPoint={dragPoint}
          onDismiss={closeMenu}
          onActivate={() => {
            closeMenu();
            onActivate?.();
          }}
          dragEnabled={dragEnabled}
          onDragBegin={beginDrag}
          onDragUpdate={updateDrag}
          onDragFinish={(x, y) => finishDrag(x, y, false)}
        />
      )}
    </div>
  );
}
