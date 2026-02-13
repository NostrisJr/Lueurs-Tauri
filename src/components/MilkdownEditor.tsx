import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css"; // TODO: custom theme
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";

interface Props {
    value: string;
    onChange: (markdown: string) => void;
    className?: string;
}

const CrepeEditor: React.FC<Props> = ({ value, onChange }) => {
    useEditor((root) => {
        const crepe = new Crepe({
            root,
            defaultValue: value,
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

export const MilkdownEditor: React.FC<Props> = ({ value, onChange, className }) => {
    return (
        <div className={className}>
            <MilkdownProvider>
                <CrepeEditor value={value} onChange={onChange} />
            </MilkdownProvider>
        </div>
    );
};