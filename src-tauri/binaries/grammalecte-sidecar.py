#!/usr/bin/env python3
"""
Grammalecte sidecar pour Lueurs.
Lit le texte depuis stdin (EOF = fermeture du pipe côté Rust),
retourne les erreurs en JSON sur stdout.
"""
import sys
import json

# PyInstaller (--onefile) extrait dans sys._MEIPASS ;
# les imports grammalecte.* sont relatifs à ce répertoire.
if getattr(sys, "frozen", False):
    sys.path.insert(0, sys._MEIPASS)

import grammalecte


def main():
    text = sys.stdin.read()

    if not text.strip():
        print(json.dumps({"grammalecte": "?", "lang": "fr", "data": []}, ensure_ascii=False), flush=True)
        return

    gc = grammalecte.GrammarChecker("fr")
    paragraphs = text.split("\n")
    data = []

    for i, para in enumerate(paragraphs, 1):
        if not para.strip():
            continue
        para_json_str = gc.getParagraphErrorsAsJSON(i, para, bSpellSugg=True, bEmptyIfNoErrors=False)
        if para_json_str:
            data.append(json.loads(para_json_str))

    result = {"grammalecte": gc.gce.version, "lang": gc.gce.lang, "data": data}
    print(json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
