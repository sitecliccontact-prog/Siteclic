/* Fond du tableau de bord : une onde de « clic » orange qui se propage doucement, sur un noir légèrement texturé. */

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E\")";

export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[680px] overflow-hidden">
      {/* Lueur chaude */}
      <div className="absolute -right-[20%] -top-[30%] h-[900px] w-[900px] rounded-full opacity-70 sm:right-[-6%]"
        style={{ background: "radial-gradient(closest-side, rgba(255,91,31,.28), rgba(255,91,31,.08) 45%, transparent 72%)" }} />
      <div className="absolute -left-[30%] top-[10%] h-[600px] w-[600px] rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(245,244,240,.05), transparent 70%)" }} />

      {/* Ondes autour du point de clic */}
      <div className="absolute right-[-300px] top-[-180px] h-[620px] w-[620px] sm:right-[4%] sm:top-[-160px]">
        <svg viewBox="0 0 620 620" className="absolute inset-0 h-full w-full">
          {[70, 120, 175, 235, 300].map((r, i) => (
            <circle key={r} cx="310" cy="310" r={r} fill="none" stroke="#f5f4f0" strokeOpacity={0.11 - i * 0.018} strokeWidth="1" />
          ))}
        </svg>
        <span className="ripple absolute left-1/2 top-1/2 h-[140px] w-[140px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-clic/60" />
        <span className="ripple ripple-2 absolute left-1/2 top-1/2 h-[140px] w-[140px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-clic/50" />
        <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-clic shadow-[0_0_24px_6px_rgba(255,91,31,.55)]" />
      </div>

      {/* Grain + fondu vers le noir */}
      <div className="absolute inset-0 opacity-[.07] mix-blend-overlay" style={{ backgroundImage: GRAIN }} />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent to-cream" />
    </div>
  );
}
