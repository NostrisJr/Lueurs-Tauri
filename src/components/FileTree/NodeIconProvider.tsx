import SFIcon from "@bradleyhodges/sfsymbols-react";
import { NoteType, SystemField } from "../../lib/noteTypes";
import {
  sfTextDocument,
  sfDocument,
  sfCylinderSplit1x2Fill,
  sfCylinderSplit1x2,
  sfAppendPage,
} from "@bradleyhodges/sfsymbols";
import type { NoteFile } from "./hooks/useFileTree";

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
