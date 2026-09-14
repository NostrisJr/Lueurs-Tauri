/**
 * MobileLinkMenu.tsx
 *
 * Bottom sheet d'actions sur un lien (déclenché par appui long).
 * Ouvrir (note → navigation, URL → externe) / Modifier / Supprimer (retire le mark).
 */

import { editorViewCtx, schemaCtx } from "@milkdown/kit/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import clsx from "clsx";
import { useAtom } from "jotai";
import { activeEditorRef } from "../../../shared/components/NoteEditor/lib/activeEditorRef";
import { mobileLinkMenuAtom } from "../../../shared/lib/atoms";
import { createLogger } from "../../../shared/lib/logger";
import { setWikilinkEdit } from "../../../shared/plugins/wikilink/wikilinkEditState";
import {
  isExternalHref,
  labelFromTarget,
  wikilinkBridge,
} from "../../../shared/plugins/wikilink/wikilinkPlugin";
import { BottomSheet } from "../BottomSheet/BottomSheet";

const log = createLogger("MobileLinkMenu");

export function MobileLinkMenu() {
  const [menu, setMenu] = useAtom(mobileLinkMenuAtom);
  if (!menu) return null;

  const external = isExternalHref(menu.href);
  const label =
    menu.text || (external ? menu.href : labelFromTarget(menu.href));
  const canOpen = external || !!wikilinkBridge.current?.resolve(menu.href);

  function close() {
    setMenu(null);
  }

  function openLink() {
    if (!menu) return;
    if (isExternalHref(menu.href)) {
      const url = menu.href.startsWith("www.")
        ? `https://${menu.href}`
        : menu.href;
      openUrl(url).catch((err) => log.error("ouverture URL échouée", err));
    } else {
      const id = wikilinkBridge.current?.resolve(menu.href);
      if (id) wikilinkBridge.current?.open(id, false);
    }
    log.info("ouverture lien depuis menu mobile", { href: menu.href });
    close();
  }

  function editLink() {
    if (!menu) return;
    setWikilinkEdit({
      range: menu.range,
      coords: { left: 16, top: 90, bottom: 90 },
      initialQuery: isExternalHref(menu.href)
        ? menu.href
        : labelFromTarget(menu.href),
      initialAlias: menu.text,
    });
    close();
  }

  function removeLink() {
    if (!menu) return;
    const editor = activeEditorRef.current;
    if (!editor) return;
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const linkMark = ctx.get(schemaCtx).marks.link;
      if (!linkMark) return;
      view.dispatch(
        view.state.tr.removeMark(menu.range.from, menu.range.to, linkMark)
      );
      view.focus();
    });
    log.info("lien supprimé depuis menu mobile", { href: menu.href });
    close();
  }

  return (
    <BottomSheet onClose={close} title={`« ${label} »`} heightFraction={0.4}>
      <div className={clsx("flex flex-col divide-y", "divide-line")}>
        <button
          type="button"
          onClick={openLink}
          disabled={!canOpen}
          className={clsx(
            "w-full px-4 py-4 text-left text-base transition-colors disabled:active:bg-transparent",
            "text-link",
            "active:bg-link/10 disabled:text-ink-5"
          )}
        >
          Ouvrir le lien
        </button>
        <button
          type="button"
          onClick={editLink}
          className={clsx(
            "w-full px-4 py-4 text-left text-base transition-colors",
            "text-ink-2",
            "active:bg-surface-2"
          )}
        >
          Modifier le lien…
        </button>
        <button
          type="button"
          onClick={removeLink}
          className={clsx(
            "w-full px-4 py-4 text-left text-base transition-colors",
            "text-danger-strong",
            "active:bg-danger-soft"
          )}
        >
          Supprimer le lien
        </button>
      </div>
    </BottomSheet>
  );
}
