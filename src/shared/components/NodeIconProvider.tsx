import type { NoteFile } from "../hooks/useFileTree";
import { NoteType, SystemField } from "../lib/noteTypes";
import {
  IconAppendPage,
  IconCylinderSplit1x2,
  IconCylinderSplit1x2Fill,
  IconDocument,
  IconTextDocument,
} from "./PlatformIcon";

function NodeIconProvider({
  node,
  className,
}: { node: NoteFile; className?: string }) {
  const hasContent =
    node.body?.trim() ||
    Object.keys(node.frontmatter ?? {}).some((k) => k !== "__Type__");

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
}

export { NodeIconProvider };
