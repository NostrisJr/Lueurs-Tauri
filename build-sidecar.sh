#!/bin/bash
# Compile le sidecar Grammalecte en binaire standalone avec PyInstaller.
# À relancer après chaque mise à jour de Grammalecte.
#
# Prérequis :
#   pip3 install pyinstaller
#
# Usage :
#   ./build-sidecar.sh /Users/theophiledonato/Desktop/Code/Grammalecte-fr-v2.3.0

set -e

GRAMMALECTE_DIR="${1:-/Users/theophiledonato/Desktop/Code/Grammalecte-fr-v2.3.0}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BINARIES_DIR="$SCRIPT_DIR/src-tauri/binaries"
WRAPPER="$BINARIES_DIR/grammalecte-sidecar.py"

# Déterminer le triple cible (aarch64-apple-darwin, x86_64-apple-darwin, etc.)
TRIPLE=$(rustc -vV | grep host | awk '{print $2}')
OUTPUT_NAME="grammalecte-sidecar-$TRIPLE"

echo "→ Triple : $TRIPLE"
echo "→ Grammalecte : $GRAMMALECTE_DIR"
echo "→ Sortie : $BINARIES_DIR/$OUTPUT_NAME"
echo ""

# Vérifier que grammalecte-cli.py est bien là
if [ ! -d "$GRAMMALECTE_DIR/grammalecte" ]; then
    echo "Erreur : dossier grammalecte/ introuvable dans $GRAMMALECTE_DIR"
    exit 1
fi

# Construire avec PyInstaller
# --onefile  → binaire unique auto-extractible (cache extraction après le 1er run)
# --add-data → embarque le package Python grammalecte + dictionnaires JSON
pyinstaller \
    --onefile \
    --name "grammalecte-sidecar" \
    --distpath "$BINARIES_DIR" \
    --workpath "$SCRIPT_DIR/.pyinstaller-build" \
    --specpath "$SCRIPT_DIR/.pyinstaller-build" \
    --add-data "$GRAMMALECTE_DIR/grammalecte:grammalecte" \
    --hidden-import=pkgutil \
    --hidden-import=importlib \
    --hidden-import=importlib.util \
    --hidden-import=importlib.machinery \
    --noconfirm \
    "$WRAPPER"

# Renommer avec le suffixe triple requis par Tauri
mv "$BINARIES_DIR/grammalecte-sidecar" "$BINARIES_DIR/$OUTPUT_NAME"

echo ""
echo "✓ Sidecar compilé : $BINARIES_DIR/$OUTPUT_NAME"
echo ""
echo "Tester avec :"
echo '  echo "Je suis aller au marché." | '"$BINARIES_DIR/$OUTPUT_NAME"
