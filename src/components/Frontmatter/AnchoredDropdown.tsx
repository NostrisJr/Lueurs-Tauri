/**
 * AnchoredDropdown — dropdown positionné en fixed sous son ancre,
 * avec détection de débordement bas → bascule au-dessus si nécessaire.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

interface AnchoredDropdownProps {
    anchorRef: { current: HTMLElement | null };
    onClose: () => void;
    children: ReactNode;
    className?: string;
}

export function AnchoredDropdown({ anchorRef, onClose, children, className = "" }: AnchoredDropdownProps) {
    const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
    const [openUpward, setOpenUpward] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const DROPDOWN_HEIGHT = 240;

    useEffect(() => {
        if (!anchorRef.current) return;
        const rect = anchorRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const up = spaceBelow < DROPDOWN_HEIGHT && rect.top > DROPDOWN_HEIGHT;
        setOpenUpward(up);
        setPos({ top: up ? rect.top : rect.bottom + 4, left: rect.left, width: rect.width });
    }, [anchorRef]);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (
                containerRef.current && !containerRef.current.contains(e.target as Node) &&
                !anchorRef.current?.contains(e.target as Node)
            ) onClose();
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [onClose, anchorRef]);

    if (!pos) return null;

    return (
        <div
            ref={containerRef}
            style={{
                position: "fixed",
                top: openUpward ? undefined : pos.top,
                bottom: openUpward ? window.innerHeight - pos.top : undefined,
                left: pos.left,
                minWidth: Math.max(pos.width, 220),
                zIndex: 9999,
            }}
            className={`bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden ${className}`}
        >
            {children}
        </div>
    );
}