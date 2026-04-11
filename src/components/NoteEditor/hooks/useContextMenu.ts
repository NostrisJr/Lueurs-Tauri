import { useEffect } from "react";
import type { RefObject } from "react";
import type { Editor } from "@milkdown/kit/core";
import { commandsCtx } from "@milkdown/kit/core";
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleLinkCommand,
  insertHrCommand,
  turnIntoTextCommand,
} from "@milkdown/kit/preset/commonmark";
import { toggleStrikethroughCommand } from "@milkdown/kit/preset/gfm";
import { insert } from "@milkdown/kit/utils";
import {
  toggleBlockquoteCommand,
  toggleBulletListCommand,
  toggleOrderedListCommand,
  toggleTaskListCommand,
  toggleHeadingCommand,
  toggleCodeBlockCommand,
} from "../../../plugins/customKeymap";
import { Menu, MenuItem, PredefinedMenuItem, Submenu } from "@tauri-apps/api/menu";
import { open } from "@tauri-apps/plugin-dialog";
import { createLogger } from "../../../lib/logger";

const log = createLogger("useContextMenu");

export function useContextMenu(
  editorRef: RefObject<Editor | null>,
  wrapperRef: RefObject<HTMLDivElement | null>,
  insertImageBlock: (srcPath: string, alt: string) => void,
  insertAudioBlock: (srcPath: string, title: string) => void
) {
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const handler = async (e: MouseEvent) => {
      e.preventDefault();

      // biome-ignore lint/suspicious/noExplicitAny: CmdKey générique Milkdown
      const call = (cmdKey: any, payload?: any) =>
        editorRef.current?.action((ctx) =>
          ctx.get(commandsCtx).call(cmdKey, payload)
        );

      try {
        const [formatSubmenu, structureSubmenu, insertSubmenu] = await Promise.all([
          Submenu.new({
            text: "Format",
            items: await Promise.all([
              MenuItem.new({ text: "Gras\t⌘B",         action: () => call(toggleStrongCommand.key) }),
              MenuItem.new({ text: "Italique\t⌘I",      action: () => call(toggleEmphasisCommand.key) }),
              MenuItem.new({ text: "Barré\t⌘⇧S",       action: () => call(toggleStrikethroughCommand.key) }),
              MenuItem.new({ text: "Code inline\t⌘`",   action: () => call(toggleInlineCodeCommand.key) }),
              MenuItem.new({ text: "Lien\t⌘⇧K",        action: () => call(toggleLinkCommand.key) }),
            ]),
          }),
          Submenu.new({
            text: "Structure",
            items: await Promise.all([
              MenuItem.new({ text: "Paragraphe\t⌘⌥0",      action: () => call(turnIntoTextCommand.key) }),
              MenuItem.new({ text: "Titre 1\t⌘⌥1",         action: () => call(toggleHeadingCommand.key, { level: 1 }) }),
              MenuItem.new({ text: "Titre 2\t⌘⌥2",         action: () => call(toggleHeadingCommand.key, { level: 2 }) }),
              MenuItem.new({ text: "Titre 3\t⌘⌥3",         action: () => call(toggleHeadingCommand.key, { level: 3 }) }),
              MenuItem.new({ text: "Titre 4\t⌘⌥4",         action: () => call(toggleHeadingCommand.key, { level: 4 }) }),
              MenuItem.new({ text: "Titre 5\t⌘⌥5",         action: () => call(toggleHeadingCommand.key, { level: 5 }) }),
              MenuItem.new({ text: "Titre 6\t⌘⌥6",         action: () => call(toggleHeadingCommand.key, { level: 6 }) }),
              MenuItem.new({ text: "Citation\t⌘⇧B",        action: () => call(toggleBlockquoteCommand.key) }),
              MenuItem.new({ text: "Liste à puces\t⌘⇧8",   action: () => call(toggleBulletListCommand.key) }),
              MenuItem.new({ text: "Liste numérotée\t⌘⇧7", action: () => call(toggleOrderedListCommand.key) }),
              MenuItem.new({ text: "Liste de tâches\t⌘⇧9", action: () => call(toggleTaskListCommand.key) }),
              MenuItem.new({ text: "Bloc de code\t⌘⌥C",    action: () => call(toggleCodeBlockCommand.key) }),
              MenuItem.new({ text: "Séparateur\t⌘⇧H",      action: () => call(insertHrCommand.key) }),
            ]),
          }),
          Submenu.new({
            text: "Insérer",
            items: await Promise.all([
              MenuItem.new({
                text: "Image…",
                action: async () => {
                  const path = await open({
                    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }],
                  });
                  if (path) {
                    log.info("image sélectionnée via dialog", { path });
                    insertImageBlock(path as string, "image");
                  }
                },
              }),
              MenuItem.new({
                text: "Audio…",
                action: async () => {
                  const path = await open({
                    filters: [{ name: "Audio", extensions: ["mp3", "m4a", "wav", "ogg", "flac", "aac"] }],
                  });
                  if (path) {
                    log.info("audio sélectionné via dialog", { path });
                    const filename = (path as string).split("/").pop() ?? "audio";
                    insertAudioBlock(path as string, filename);
                  }
                },
              }),
              MenuItem.new({
                text: "Tableau",
                action: () => {
                  editorRef.current?.action(
                    insert("| Col 1 | Col 2 |\n|-------|-------|\n|       |       |")
                  );
                },
              }),
            ]),
          }),
        ]);

        const menu = await Menu.new({
          items: [
            await PredefinedMenuItem.new({ item: "Cut" }),
            await PredefinedMenuItem.new({ item: "Copy" }),
            await PredefinedMenuItem.new({ item: "Paste" }),
            await PredefinedMenuItem.new({ item: "Separator" }),
            formatSubmenu,
            structureSubmenu,
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
  }, [editorRef, wrapperRef, insertImageBlock, insertAudioBlock]);
}
