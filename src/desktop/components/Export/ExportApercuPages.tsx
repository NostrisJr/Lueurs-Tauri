export function ExportApercuPages({
  pages,
  recompilation,
  erreur,
}: {
  pages: (string | null)[];
  recompilation: boolean;
  erreur: string | null;
}) {
  return (
    <div className="flex-1 bg-gray-50 rounded-r-xl flex items-center justify-center overflow-hidden relative">
      {erreur ? (
        <div className="p-6 max-w-sm text-center">
          <p className="text-xs font-medium text-red-600 mb-1">
            Erreur de compilation
          </p>
          <p className="text-xs text-red-500 font-mono whitespace-pre-wrap break-all">
            {erreur}
          </p>
        </div>
      ) : pages.length > 0 ? (
        <div className="relative w-full h-full overflow-y-auto">
          <div
            className={`flex flex-col items-center gap-4 p-4 transition-opacity duration-150 ${recompilation ? "opacity-40" : "opacity-100"}`}
          >
            {pages.map((svgBase64, i) =>
              svgBase64 ? (
                <img
                  // biome-ignore lint/suspicious/noArrayIndexKey: pages ordonnées, pas de réordonnancement
                  key={i}
                  src={`data:image/svg+xml;base64,${svgBase64}`}
                  alt={`Page ${i + 1}`}
                  className="w-full shadow-sm bg-white"
                  style={{ display: "block" }}
                />
              ) : (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: pages ordonnées, pas de réordonnancement
                  key={i}
                  className="w-full bg-white shadow-sm"
                  style={{ aspectRatio: "1 / 1.414" }}
                />
              )
            )}
          </div>
          {recompilation && (
            <div className="absolute inset-0 flex items-end justify-center pb-4 pointer-events-none">
              <span className="text-xs text-gray-500 bg-white/90 px-3 py-1 rounded-full shadow-sm">
                Recompilation…
              </span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-400">Compilation en cours…</p>
      )}
    </div>
  );
}
