import type { Node as ProseMirrorNode } from "@milkdown/kit/prose/model";

// NodeView : la pipe gauche et la pipe droite sont contenteditable=false.
// Le curseur peut donc se positionner avant le nœud, dans le contentDOM,
// ou après le nœud — sans pouvoir entrer dans les pipes elles-mêmes.
// L'espace après `|` et avant `|` est purement présentation.
export function createDidascalieInlineNodeView() {
    return (_node: ProseMirrorNode) => {
        const dom = document.createElement("span");
        dom.className = "didascalie-inline";
        dom.setAttribute("data-didascalie-inline", "");

        const openPipe = document.createElement("span");
        openPipe.className = "didascalie-pipe didascalie-pipe-open";
        openPipe.setAttribute("contenteditable", "false");
        openPipe.textContent = "| ";

        const content = document.createElement("span");
        content.className = "didascalie-content";

        const closePipe = document.createElement("span");
        closePipe.className = "didascalie-pipe didascalie-pipe-close";
        closePipe.setAttribute("contenteditable", "false");
        closePipe.textContent = " |";

        dom.appendChild(openPipe);
        dom.appendChild(content);
        dom.appendChild(closePipe);

        return { dom, contentDOM: content };
    };
}
