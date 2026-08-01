import {
  type ImpactFeedbackStyle,
  impactFeedback,
  selectionFeedback,
} from "@tauri-apps/plugin-haptics";
import { createLogger } from "../../shared/lib/logger";

const log = createLogger("haptics");

// Un échec du plugin est sans conséquence fonctionnelle, mais l'avaler
// silencieusement rend indébogable un retour haptique "qui ne se sent pas".
export function hapticImpact(style: ImpactFeedbackStyle = "light") {
  impactFeedback(style).catch((err) =>
    log.warn("impactFeedback indisponible", { style, err })
  );
}

export function hapticSelection() {
  selectionFeedback().catch((err) =>
    log.warn("selectionFeedback indisponible", { err })
  );
}
