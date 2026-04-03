#!/bin/sh
# Wrapper autour de `pnpm tauri ios build` qui restaure les fichiers iOS
# écrasés par la regénération du projet Xcode.

set -e

OVERRIDES="src-tauri/ios-overrides"
GEN="src-tauri/gen/apple"

pnpm tauri ios build "$@"

echo "→ Restauration des overrides iOS..."
cp "$OVERRIDES/lueurs-tauri_iOS.entitlements" "$GEN/lueurs-tauri_iOS/lueurs-tauri_iOS.entitlements"
cp "$OVERRIDES/Info.plist"                    "$GEN/lueurs-tauri_iOS/Info.plist"
cp "$OVERRIDES/PrivacyInfo.xcprivacy"         "$GEN/PrivacyInfo.xcprivacy"
echo "✓ Overrides appliqués."
