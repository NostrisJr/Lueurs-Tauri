export function TitleBar() {
  return (
    <div
      data-tauri-drag-region
      className="fixed top-0 left-0 right-0 h-9 z-50 select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    />
  );
}
