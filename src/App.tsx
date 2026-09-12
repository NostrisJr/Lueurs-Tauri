import { DesktopApp } from "./desktop/DesktopApp";
import { MobileApp } from "./mobile/MobileApp";
import { isMobile } from "./shared/lib/platform";

export default function App() {
  if (isMobile)
    return (
      <div className="w-screen h-screen">
        <MobileApp />
      </div>
    );

  return <DesktopApp />;
}
