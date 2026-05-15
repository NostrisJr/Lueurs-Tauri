import {
  type ImpactFeedbackStyle,
  impactFeedback,
  selectionFeedback,
} from "@tauri-apps/plugin-haptics";

export function hapticImpact(style: ImpactFeedbackStyle = "light") {
  impactFeedback(style).catch(() => {});
}

export function hapticSelection() {
  selectionFeedback().catch(() => {});
}
