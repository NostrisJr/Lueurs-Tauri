import {
  sfAppendPage,
  sfCylinderSplit1x2,
  sfCylinderSplit1x2Fill,
  sfDocument,
  sfTextDocument,
} from "@bradleyhodges/sfsymbols";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import type { NoteFile } from "../hooks/useFileTree";
import { NoteType, SystemField } from "../lib/noteTypes";

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
    return (
      <SFIcon
        icon={hasContent ? sfTextDocument : sfDocument}
        className={className}
        aria-hidden="true"
      />
    );
  }

  if (node.type === NoteType.BASE) {
    return (
      <SFIcon
        icon={hasChildren ? sfCylinderSplit1x2Fill : sfCylinderSplit1x2}
        className={className}
        aria-hidden="true"
      />
    );
  }

  if (node.type === NoteType.TEMPLATE) {
    return (
      <SFIcon icon={sfAppendPage} className={className} aria-hidden="true" />
    );
  }
}

export { NodeIconProvider };
