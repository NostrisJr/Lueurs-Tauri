import type React from "react";
import EmojiPicker, {
  type EmojiClickData,
  EmojiStyle,
} from "emoji-picker-react";
import { isMobile } from "../lib/platform";

interface Props {
  onSelect: (emoji: string) => void;
  height?: number;
}

export function EmojiMartPicker({ onSelect, height }: Props) {
  const handleClick = (data: EmojiClickData) => onSelect(data.emoji);

  // CSS variables passées via style sont appliquées sur le <aside> racine du picker
  // et surchargent les défauts de emoji-picker-react.
  const mobileStyle = {
    border: "none",
    boxShadow: "none",
    "--epr-picker-border-radius": "0px",
  } as React.CSSProperties;

  return (
    <EmojiPicker
      onEmojiClick={handleClick}
      width={isMobile ? "100%" : undefined}
      height={isMobile ? 400 : height}
      skinTonesDisabled
      previewConfig={{ showPreview: false }}
      searchPlaceholder="Rechercher…"
      lazyLoadEmojis
      emojiStyle={EmojiStyle.NATIVE}
      style={isMobile ? mobileStyle : undefined}
    />
  );
}
