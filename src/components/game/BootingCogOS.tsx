"use client";

export function BootingCogOS() {
  return (
    <main className="min-h-screen px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-2">
          <h1 className="font-mono text-lg font-bold text-gradient-primary">CogOS</h1>
          <p className="font-mono text-xs text-muted-foreground">Booting CogOS...</p>
        </header>

        <div className="surface-glass animate-pulse rounded-lg p-6">
          <div className="mb-4 h-5 w-1/3 rounded bg-white/10" />
          <div className="mb-2 h-3 w-full rounded bg-white/10" />
          <div className="mb-2 h-3 w-11/12 rounded bg-white/10" />
          <div className="h-3 w-2/3 rounded bg-white/10" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="surface-glass animate-pulse rounded-lg p-4">
              <div className="mb-3 h-3 w-1/2 rounded bg-white/10" />
              <div className="space-y-2">
                <div className="h-8 rounded bg-white/10" />
                <div className="h-8 rounded bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
