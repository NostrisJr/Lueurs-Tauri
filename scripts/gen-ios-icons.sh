#!/bin/bash
# scripts/gen-ios-icons.sh

set -e

ICON_SOURCE="${1:-public/icon_ios.png}"
TEMP_DIR=".icon-tmp"
APP_NAME="lueurs-tauri"
IOS_ASSETS="src-tauri/gen/apple/$APP_NAME/Assets.xcassets/AppIcon.appiconset"

if [ ! -f "$ICON_SOURCE" ]; then
  echo "❌ Icône source introuvable : $ICON_SOURCE"
  exit 1
fi

echo "🎨 Génération des icônes dans le dossier temporaire..."
pnpm tauri icon "$ICON_SOURCE" -o "$TEMP_DIR"

echo "📦 Copie des icônes iOS vers la destination..."
cp -r "$TEMP_DIR"/ios/. "$IOS_ASSETS/"

echo "🧹 Nettoyage..."
rm -rf "$TEMP_DIR"

echo "✅ Done"