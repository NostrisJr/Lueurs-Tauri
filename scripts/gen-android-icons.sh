#!/bin/bash
# scripts/gen-android-icons.sh

set -e

ICON_SOURCE="${1:-public/icon_android.png}"
TEMP_DIR=".icon-tmp"
ANDROID_RES="src-tauri/gen/android/app/src/main/res"

if [ ! -f "$ICON_SOURCE" ]; then
  echo "❌ Icône source introuvable : $ICON_SOURCE"
  exit 1
fi

echo "🎨 Génération des icônes dans le dossier temporaire..."
pnpm tauri icon "$ICON_SOURCE" -o "$TEMP_DIR"

echo "📦 Copie des icônes Android vers la destination..."
cp -r "$TEMP_DIR"/android/. "$ANDROID_RES/"

echo "🧹 Nettoyage..."
rm -rf "$TEMP_DIR"

echo "✅ Done"