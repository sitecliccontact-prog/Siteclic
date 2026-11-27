/* Pendant le chargement d'une page de l'espace commerçant. */
export default function Loading() {
  return (
    <main className="grid min-h-dvh place-items-center px-5" aria-busy="true" aria-live="polite">
      <div className="flex flex-col items-center gap-4 text-sm text-muted">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-clic" />
        Un instant…
      </div>
    </main>
  );
}
