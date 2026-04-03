# Setup

## Prérequis

### Node.js + pnpm
```bash
# Node.js via nvm (recommandé)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
nvm install --lts

# pnpm
npm install -g pnpm
```

### Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Tauri (dépendances système macOS)
```bash
xcode-select --install
```

## Installation

```bash
pnpm install
```

## Lancer l'app

```bash
pnpm tauri dev        # Desktop (Rust + React)
pnpm dev              # Frontend uniquement
```

---

## iOS (simulateur)

### Prérequis supplémentaires

1. **Xcode complet** installé depuis le Mac App Store (pas seulement les CLT)

2. **Pointer xcode-select sur Xcode.app** (indispensable pour `simctl`) :
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```

3. **Tauri iOS target** :
   ```bash
   rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
   cargo install tauri-cli --version "^2"
   pnpm tauri ios init
   ```

4. **CocoaPods** :
   ```bash
   sudo brew install cocoapods
   ```

5. **Team ID** — dans `src-tauri/tauri.conf.json`, renseigner :
   ```json
   "bundle": {
     "iOS": {
       "developmentTeam": "XXXXXXXXXX"
     }
   }
   ```
   Ou via variable d'environnement : `export APPLE_DEVELOPMENT_TEAM=XXXXXXXXXX`

6. **PrivacyInfo.xcprivacy** — Apple exige ce fichier pour l'accès aux timestamps de fichiers. À créer dans `src-tauri/gen/apple/PrivacyInfo.xcprivacy` :
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
     <dict>
       <key>NSPrivacyAccessedAPITypes</key>
       <array>
         <dict>
           <key>NSPrivacyAccessedAPIType</key>
           <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
           <key>NSPrivacyAccessedAPITypeReasons</key>
           <array>
             <string>C617.1</string>
           </array>
         </dict>
       </array>
     </dict>
   </plist>
   ```
   > ⚠️ Ce fichier est dans `gen/` qui est regénéré par `tauri ios init` — ne pas relancer cette commande sans recréer le fichier.

### Lancer sur simulateur

```bash
pnpm tauri ios dev
```