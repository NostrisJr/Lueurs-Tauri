import { DesktopApp } from "./desktop/DesktopApp";
import { MobileApp } from "./mobile/MobileApp";
import { useTheme } from "./shared/hooks/useTheme";
import { isMobile } from "./shared/lib/platform";

export default function App() {
  // Monté au-dessus des deux racines : le thème s'applique aussi au
  // WelcomeScreen, qui court-circuite le rendu de DesktopApp.
  useTheme();

  if (isMobile)
    return (
      <div className="w-screen h-screen">
        <MobileApp />
      </div>
    );

  return <DesktopApp />;
}
