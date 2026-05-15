import type { Editor } from "@milkdown/kit/core";
import { commandsCtx } from "@milkdown/kit/core";
import { insertHrCommand } from "@milkdown/kit/preset/commonmark";
import { insert } from "@milkdown/kit/utils";
import {
  Menu,
  MenuItem,
  PredefinedMenuItem,
  Submenu,
} from "@tauri-apps/api/menu";
import { open } from "@tauri-apps/plugin-dialog";
import { platform } from "@tauri-apps/plugin-os";
import { useEffect } from "react";
import type { RefObject } from "react";
import { createLogger } from "../../../lib/logger";
import { EDITOR_FORMATTING_GROUPS } from "../formattingMenuData";

const log = createLogger("useContextMenu");

export function useContextMenu(
  editorRef: RefObject<Editor | null>,
  wrapperRef: RefObject<HTMLDivElement | null>,
  insertImageBlock: (srcPath: string, alt: string) => void,
  insertAudioBlock: (srcPath: string, title: string) => void
) {
  useEffect(() => {
    // Menu natif Tauri — desktop uniquement
    if (platform() === "ios") return;

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
        const submenus = await Promise.all(
          EDITOR_FORMATTING_GROUPS.map(async (group) => {
            const menuItems = await Promise.all(
              group.items.map((item) =>
                MenuItem.new({
                  text: item.shortcut
                    ? `${item.label}\t${item.shortcut}`
                    : item.label,
                  action: () => call(item.cmdKey, item.payload),
                })
              )
            );
            return Submenu.new({ text: group.label, items: menuItems });
          })
        );

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
                  insertImageBlock(path as string, "image");
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
                  const filename = (path as string).split("/").pop() ?? "audio";
                  insertAudioBlock(path as string, filename);
                }
              },
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
            await PredefinedMenuItem.new({ item: "Cut" }),
            await PredefinedMenuItem.new({ item: "Copy" }),
            await PredefinedMenuItem.new({ item: "Paste" }),
            await PredefinedMenuItem.new({ item: "Separator" }),
            ...submenus,
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
