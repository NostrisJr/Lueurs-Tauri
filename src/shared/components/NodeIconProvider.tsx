import type { MediaFile, NoteFile } from "../hooks/useFileTree";
import { NoteType, SystemField } from "../lib/noteTypes";
import {
  IconAppendPage,
  IconCylinderSplit1x2,
  IconCylinderSplit1x2Fill,
  IconDocument,
  IconDocumentPdf,
  IconFilmIcon,
  IconMusicNote,
  IconPhoto,
  IconTextDocument,
} from "./PlatformIcon";

function NodeIconProvider({
  node,
  className,
}: { node: NoteFile | MediaFile; className?: string }) {
  if (node.kind === "media") {
    switch (node.mediaType) {
      case "image":
        return <IconPhoto className={className} aria-hidden="true" />;
      case "audio":
        return <IconMusicNote className={className} aria-hidden="true" />;
      case "video":
        return <IconFilmIcon className={className} aria-hidden="true" />;
      case "pdf":
        return <IconDocumentPdf className={className} aria-hidden="true" />;
    }
  }

  const hasContent =
    node.body?.trim() ||
    Object.keys(node.frontmatter ?? {}).some((k) => k !== SystemField.TYPE);

  const children = node.frontmatter?.[SystemField.CHILDREN];
  const hasChildren = Array.isArray(children) && children.length > 0;

  if (node.type === NoteType.NOTE) {
    const Icon = hasContent ? IconTextDocument : IconDocument;
    return <Icon className={className} aria-hidden="true" />;
  }

  if (node.type === NoteType.BASE) {
    const Icon = hasChildren ? IconCylinderSplit1x2Fill : IconCylinderSplit1x2;
    return <Icon className={className} aria-hidden="true" />;
  }

  if (node.type === NoteType.TEMPLATE) {
    return <IconAppendPage className={className} aria-hidden="true" />;
  }
  return null;
}

export { NodeIconProvider };
