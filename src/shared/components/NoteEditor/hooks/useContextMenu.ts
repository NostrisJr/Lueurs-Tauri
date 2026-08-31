import type { Editor } from "@milkdown/kit/core";
import { commandsCtx, editorViewCtx, schemaCtx } from "@milkdown/kit/core";
import { insertHrCommand } from "@milkdown/kit/preset/commonmark";
import { TextSelection } from "@milkdown/kit/prose/state";
import { insert } from "@milkdown/kit/utils";
import {
  Menu,
  MenuItem,
  PredefinedMenuItem,
  Submenu,
} from "@tauri-apps/api/menu";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { platform } from "@tauri-apps/plugin-os";
import { useAtomValue } from "jotai";
import { useEffect } from "react";
import type { RefObject } from "react";
import { spellcheckEngineAtom } from "../../../lib/atoms";
import { createLogger } from "../../../lib/logger";
import { vaultIO } from "../../../lib/vaultIO";
import { toggleHighlightInlineCommand } from "../../../plugins/customKeymap";
import { HIGHLIGHT_COLORS } from "../../../plugins/highlight/colors";
import {
  nativeLearnWord,
  nativeSpellSuggestions,
} from "../../../plugins/spellcheck/appleApi";
import { getSpellSuggestionAtPos } from "../../../plugins/spellcheck/spellcheckPlugin";
import { wordRangeAt } from "../../../plugins/spellcheck/wordRange";
import { setWikilinkEdit } from "../../../plugins/wikilink/wikilinkEditState";
import {
  isExternalHref,
  labelFromTarget,
  linkRangeAt,
  wikilinkBridge,
} from "../../../plugins/wikilink/wikilinkPlugin";
import { editorInsertFormula } from "../lib/editorCommands";
import { EDITOR_FORMATTING_GROUPS } from "../lib/formattingMenuData";

const log = createLogger("useContextMenu");

const INSECABLE_BEFORE = /^[!?;:»]/;

function wrapLines(text: string, maxWidth = 48): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (
      current.length + 1 + word.length <= maxWidth ||
      INSECABLE_BEFORE.test(word) // ne pas couper avant ces signes
    ) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function useContextMenu(
  editorRef: RefObject<Editor | null>,
  wrapperRef: RefObject<HTMLDivElement | null>,
  insertImageBlock: (srcPath: string, alt: string) => void,
  insertAudioBlock: (srcPath: string, title: string) => void,
  vaultPath: string,
  onIgnoreWord: (word: string) => void
) {
  const spellcheckEngine = useAtomValue(spellcheckEngineAtom);

  useEffect(() => {
    // Menu natif Tauri — desktop uniquement
    if (platform() === "ios") return;

    const el = wrapperRef.current;
    if (!el) return;

    const handler = async (e: MouseEvent) => {
      e.preventDefault();

      // Le menu natif Tauri vole le focus → la sélection ProseMirror est perdue
      // quand l'action s'exécute. On la capture au clic droit et on la restaure
      // avant chaque commande (sinon les toggles sur sélection font no-op).
      let savedSelection: { from: number; to: number } | null = null;
      let spellSuggestion: {
        from: number;
        to: number;
        word: string;
        message: string;
        replacements: string[];
        category: "spelling" | "grammar";
      } | null = null;
      let linkInfo: {
        from: number;
        to: number;
        href: string;
        text: string;
      } | null = null;
      // Moteur Apple : NSSpellChecker ne pose pas de décorations, on délimite
      // donc le mot sous le curseur pour l'interroger à la demande.
      let clickedWord: { from: number; to: number; word: string } | null = null;
      editorRef.current?.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const { from, to } = view.state.selection;
        savedSelection = { from, to };
        const result = view.posAtCoords({ left: e.clientX, top: e.clientY });
        if (result) {
          spellSuggestion = getSpellSuggestionAtPos(view, result.pos);
          linkInfo = linkRangeAt(view.state, result.pos);
          if (spellcheckEngine === "apple") {
            clickedWord = wordRangeAt(view.state, result.pos);
          }
        }
      });

      // biome-ignore lint/suspicious/noExplicitAny: CmdKey générique Milkdown
      const call = (cmdKey: any, payload?: any) =>
        editorRef.current?.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          view.focus();
          if (savedSelection) {
            const { from, to } = savedSelection;
            view.dispatch(
              view.state.tr.setSelection(
                TextSelection.create(view.state.doc, from, to)
              )
            );
          }
          ctx.get(commandsCtx).call(cmdKey, payload);
        });

      const applySpellReplacement = (
        from: number,
        to: number,
        replacement: string
      ) =>
        editorRef.current?.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const schema = ctx.get(schemaCtx);
          const { doc } = view.state;
          // Conserver les marques qui couvrent le mot (didascalie, surlignage,
          // code…), sinon le remplacement non marqué scinderait la mise en forme.
          const marks = doc.resolve(from).marksAcross(doc.resolve(to));
          view.dispatch(
            view.state.tr.replaceWith(from, to, schema.text(replacement, marks))
          );
          view.focus();
        });

      type LinkInfo = { from: number; to: number; href: string; text: string };

      const openLink = (info: LinkInfo) => {
        if (isExternalHref(info.href)) {
          const url = info.href.startsWith("www.")
            ? `https://${info.href}`
            : info.href;
          openUrl(url).catch((err) => log.error("ouverture URL échouée", err));
          return;
        }
        const id = wikilinkBridge.current?.resolve(info.href);
        if (id) wikilinkBridge.current?.open(id, false);
      };

      const editLink = (info: LinkInfo) =>
        setWikilinkEdit({
          range: { from: info.from, to: info.to },
          initialQuery: isExternalHref(info.href)
            ? info.href
            : labelFromTarget(info.href),
          initialAlias: info.text,
        });

      const removeLink = (info: LinkInfo) =>
        editorRef.current?.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const linkMark = ctx.get(schemaCtx).marks.link;
          if (!linkMark) return;
          view.dispatch(view.state.tr.removeMark(info.from, info.to, linkMark));
          view.focus();
        });

      try {
        // Items lien en tête si le clic droit est sur un lien (note ou web).
        // biome-ignore lint/suspicious/noExplicitAny: contournement narrowing TS
        const link = linkInfo as any as LinkInfo | null;
        const wikilinkItems: (MenuItem | PredefinedMenuItem)[] = [];
        if (link) {
          const canOpen =
            isExternalHref(link.href) ||
            !!wikilinkBridge.current?.resolve(link.href);
          wikilinkItems.push(
            await MenuItem.new({
              text: "Ouvrir le lien",
              enabled: canOpen,
              action: () => openLink(link),
            }),
            await MenuItem.new({
              text: "Modifier le lien…",
              action: () => editLink(link),
            }),
            await MenuItem.new({
              text: "Supprimer le lien",
              action: () => removeLink(link),
            }),
            await PredefinedMenuItem.new({ item: "Separator" })
          );
        }

        // Items de correction orthographique en tête si le clic droit est sur une faute.
        // Cast nécessaire : TS narrow spellSuggestion à null après ?.action() (callback non garanti).
        // biome-ignore lint/suspicious/noExplicitAny: contournement narrowing TS
        const spell = spellSuggestion as any as {
          from: number;
          to: number;
          word: string;
          message: string;
          replacements: string[];
          category: "spelling" | "grammar";
        } | null;
        const spellItems: (MenuItem | PredefinedMenuItem)[] = [];
        if (spell) {
          if (spell.replacements.length > 0) {
            for (const rep of spell.replacements.slice(0, 5)) {
              spellItems.push(
                await MenuItem.new({
                  text: rep,
                  action: () =>
                    applySpellReplacement(spell.from, spell.to, rep),
                })
              );
            }
          } else {
            spellItems.push(
              await MenuItem.new({ text: "Aucune suggestion", enabled: false })
            );
          }
          if (spell.message) {
            for (const line of wrapLines(spell.message)) {
              spellItems.push(
                await MenuItem.new({ text: line, enabled: false })
              );
            }
          }
          if (spell.category === "spelling") {
            spellItems.push(
              await MenuItem.new({
                text: `Ignorer « ${spell.word} »`,
                action: () => onIgnoreWord(spell.word),
              })
            );
          }
          spellItems.push(await PredefinedMenuItem.new({ item: "Separator" }));
        }

        // Moteur Apple : suggestions NSSpellChecker. Elles vivent normalement
        // dans le menu contextuel WebKit, que ce menu Tauri remplace — on les
        // récupère donc côté Rust pour les réinjecter ici.
        // biome-ignore lint/suspicious/noExplicitAny: contournement narrowing TS
        const appleWord = clickedWord as any as {
          from: number;
          to: number;
          word: string;
        } | null;
        if (appleWord) {
          const guesses = await nativeSpellSuggestions(appleWord.word);
          if (guesses) {
            if (guesses.length > 0) {
              for (const rep of guesses.slice(0, 5)) {
                spellItems.push(
                  await MenuItem.new({
                    text: rep,
                    action: () =>
                      applySpellReplacement(appleWord.from, appleWord.to, rep),
                  })
                );
              }
            } else {
              spellItems.push(
                await MenuItem.new({
                  text: "Aucune suggestion",
                  enabled: false,
                })
              );
            }
            spellItems.push(
              await MenuItem.new({
                text: `Ajouter « ${appleWord.word} » au dictionnaire`,
                action: () => nativeLearnWord(appleWord.word),
              }),
              await PredefinedMenuItem.new({ item: "Separator" })
            );
          }
        }

        const submenus = await Promise.all(
          EDITOR_FORMATTING_GROUPS.map(async (group) => {
            const menuItems = await Promise.all(
              group.items.map((item) =>
                MenuItem.new({
                  text: item.shortcut
                    ? `${item.label}\t${item.shortcut}`
                    : item.label,
                  action: () => call(item.command.key, item.payload),
                })
              )
            );
            return Submenu.new({ text: group.label, items: menuItems });
          })
        );

        const highlightSubmenu = await Submenu.new({
          text: "Surligner",
          items: await Promise.all([
            // Raccourci par défaut
            MenuItem.new({
              text: "Couleur par défaut\t⌘⇧L",
              action: () => call(toggleHighlightInlineCommand.key),
            }),
            ...HIGHLIGHT_COLORS.map((c) =>
              MenuItem.new({
                text: c.label,
                action: () =>
                  call(toggleHighlightInlineCommand.key, { color: c.id }),
              })
            ),
          ]),
        });

        const insertSubmenu = await Submenu.new({
          text: "Insérer",
          items: await Promise.all([
            MenuItem.new({
              text: "Image…",
              action: async () => {
                const path = await open({
                  filters: [
                    {
                      name: "Images",
                      extensions: ["png", "jpg", "jpeg", "gif", "webp"],
                    },
                  ],
                });
                if (path) {
                  log.info("image sélectionnée via dialog", { path });
                  try {
                    const destPath = await vaultIO.copyResourceToVault(
                      path as string,
                      vaultPath,
                      "images"
                    );
                    const alt =
                      (path as string)
                        .split("/")
                        .pop()
                        ?.replace(/\.[^.]+$/, "") ?? "image";
                    insertImageBlock(destPath, alt);
                  } catch (err) {
                    log.error("échec copie image dans vault", err);
                  }
                }
              },
            }),
            MenuItem.new({
              text: "Audio…",
              action: async () => {
                const path = await open({
                  filters: [
                    {
                      name: "Audio",
                      extensions: ["mp3", "m4a", "wav", "ogg", "flac", "aac"],
                    },
                  ],
                });
                if (path) {
                  log.info("audio sélectionné via dialog", { path });
                  try {
                    const destPath = await vaultIO.copyResourceToVault(
                      path as string,
                      vaultPath,
                      "audio"
                    );
                    const title =
                      (path as string)
                        .split("/")
                        .pop()
                        ?.replace(/\.[^.]+$/, "") ?? "audio";
                    insertAudioBlock(destPath, title);
                  } catch (err) {
                    log.error("échec copie audio dans vault", err);
                  }
                }
              },
            }),
            MenuItem.new({
              text: "Formule…\t⌘⇧F",
              action: () => editorInsertFormula(editorRef),
            }),
            MenuItem.new({
              text: "Séparateur\t⌘⇧H",
              action: () =>
                editorRef.current?.action((ctx) =>
                  ctx.get(commandsCtx).call(insertHrCommand.key)
                ),
            }),
            MenuItem.new({
              text: "Tableau",
              action: () => {
                editorRef.current?.action(
                  insert(
                    "| Col 1 | Col 2 |\n|-------|-------|\n|       |       |"
                  )
                );
              },
            }),
          ]),
        });

        const menu = await Menu.new({
          items: [
            ...wikilinkItems,
            ...spellItems,
            await PredefinedMenuItem.new({ item: "Cut" }),
            await PredefinedMenuItem.new({ item: "Copy" }),
            await PredefinedMenuItem.new({ item: "Paste" }),
            await PredefinedMenuItem.new({ item: "Separator" }),
            ...submenus,
            highlightSubmenu,
            insertSubmenu,
            await PredefinedMenuItem.new({ item: "Separator" }),
            await PredefinedMenuItem.new({ item: "SelectAll" }),
          ],
        });

        await menu.popup();
        log.info("menu contextuel affiché");
      } catch (err) {
        log.error("échec construction menu contextuel", err);
      }
    };

    el.addEventListener("contextmenu", handler);
    return () => el.removeEventListener("contextmenu", handler);
  }, [
    editorRef,
    wrapperRef,
    insertImageBlock,
    insertAudioBlock,
    vaultPath,
    onIgnoreWord,
    spellcheckEngine,
  ]);
}
