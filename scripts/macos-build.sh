#!/bin/sh
# Wrapper autour de `pnpm tauri build` pour macOS :
# après la compilation et la signature initiale par Tauri, embarque le
# provisioning profile dans le bundle et re-signe avant la notarisation.

set -e

APP="src-tauri/target/release/bundle/macos/Lueurs.app"
PROFILE="src-tauri/Lueurs.provisionprofile"
ENTITLEMENTS="src-tauri/Entitlements.plist"
IDENTITY="Developer ID Application: JUBILATE POP LOUANGE (TBX8DPCBL9)"

# Tauri signe le bundle mais ne notarise pas (pas de notarize config dans tauri.conf.json).
pnpm tauri build "$@"

echo "→ Intégration du provisioning profile..."
cp "$PROFILE" "$APP/Contents/embedded.provisionprofile"

echo "→ Re-signature avec entitlements iCloud..."
codesign --force --deep \
    --sign "$IDENTITY" \
    --entitlements "$ENTITLEMENTS" \
    --options runtime \
    --timestamp \
    "$APP"

echo "→ Notarisation manuelle..."
ZIP="${APP%.app}.zip"
ditto -c -k --keepParent "$APP" "$ZIP"
xcrun notarytool submit "$ZIP" \
    --keychain-profile "notarytool-profile" \
    --wait
rm "$ZIP"

echo "→ Staple..."
xcrun stapler staple "$APP"

echo "✓ Done."
