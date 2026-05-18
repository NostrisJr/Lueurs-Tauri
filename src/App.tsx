import { platform } from "@tauri-apps/plugin-os";
import { DesktopApp } from "./desktop/DesktopApp";
import { MobileApp } from "./mobile/MobileApp";

export default function App() {
  if (platform() === "ios" || platform() === "android")
    return (
      <div className="w-screen h-screen">
        <MobileApp />
      </div>
    );

  return <DesktopApp />;
}
