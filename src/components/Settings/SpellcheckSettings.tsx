import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { createLogger } from "../../lib/logger";

const log = createLogger("SpellcheckSettings");

type TestStatus = "idle" | "running" | "ok" | "error";

export function SpellcheckSettings() {
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testError, setTestError] = useState("");

  const test = async () => {
    setTestStatus("running");
    setTestError("");
    try {
      await invoke("check_grammar", { text: "Je suis aller au marché." });
      setTestStatus("ok");
      log.info("test Grammalecte réussi");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTestError(msg);
      setTestStatus("error");
      log.error("test Grammalecte échoué", { error: msg });
    }
  };

  return (
    <section>
      <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
        Correction orthographique (Grammalecte)
      </h3>
      <div className="space-y-3">
        <p className="text-xs text-gray-500">
          Le correcteur Grammalecte est intégré directement dans l'application.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={test}
            disabled={testStatus === "running"}
            className="px-3 py-2 text-xs font-medium rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            {testStatus === "running" ? "Test en cours…" : "Tester"}
          </button>
          {testStatus === "ok" && (
            <span className="text-xs text-green-600">Grammalecte fonctionne</span>
          )}
          {testStatus === "error" && (
            <span className="text-xs text-red-600">Erreur : {testError}</span>
          )}
        </div>
      </div>
    </section>
  );
}
