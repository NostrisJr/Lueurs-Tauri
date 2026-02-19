import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import "../lib/MilkdownStyle.css"; //TODO : comprendre les différences avec les thèmes de base et qui overwrite
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { NoteFile } from "../hooks/useFileTree";
import { EditableText } from "./EditableText";
import { useNote } from "../hooks/useNote";

interface MilkdownEditorProps {
    node: NoteFile;
    onChange: (markdown: string) => void;
    className?: string;
}

function CrepeEditor({ node: note, onChange }: MilkdownEditorProps) {
    useEditor((root) => {
        const crepe = new Crepe({
            root,
            defaultValue: note.content,
            features: {
                [Crepe.Feature.CodeMirror]: true,
            },
        });

        crepe.on((listener) => {
            listener.markdownUpdated((_, markdown, prevMarkdown) => {
                if (markdown !== prevMarkdown) {
                    onChange(markdown);
                }
            });
        });

        return crepe;
    });

    return <Milkdown />;
};

export function MilkdownEditor({ node, onChange, className }: MilkdownEditorProps) {
    const { handleRename } = useNote();
    return (
        <div className={className}>
            <div className=" border-gray-100 border-b px-4 py-2 flex justify-start">
                <EditableText
                    className="text-3xl h-12 font-body border-gray-100 font-title text-left flex items-center"
                    value={node.name}
                    onSave={async (newName) => {
                        await handleRename(node.id, newName, false);
                    }}
                />
            </div>
            <MilkdownProvider>
                <CrepeEditor node={node} onChange={onChange} />
            </MilkdownProvider>
        </div>
    );
};