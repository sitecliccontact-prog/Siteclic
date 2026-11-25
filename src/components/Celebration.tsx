"use client";

import { useEffect, useState } from "react";

/* Petites animations de réussite (onde « clic » orange + coche) quand une action se termine.
   Utilisation : celebrate("Votre site est prêt", "big") n'importe où dans l'appli. */

type Kind = "big" | "small";
type Event = { message: string; kind: Kind; id: number };

export function celebrate(message: string, kind: Kind = "small") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("siteclic:celebrate", { detail: { message, kind } }));
  try {
    navigator.vibrate?.(kind === "big" ? [12, 60, 18] : 10);
  } catch {}
}

export function Celebration() {
  const [ev, setEv] = useState<Event | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const on = (e: globalThis.Event) => {
      const d = (e as CustomEvent<{ message: string; kind: Kind }>).detail;
      clearTimeout(timer);
      setEv({ ...d, id: Date.now() });
      timer = setTimeout(() => setEv(null), d.kind === "big" ? 2600 : 2200);
    };
    window.addEventListener("siteclic:celebrate", on);
    return () => {
      window.removeEventListener("siteclic:celebrate", on);
      clearTimeout(timer);
    };
  }, []);

  if (!ev) return null;

  if (ev.kind === "small") {
    return (
      <div key={ev.id} className="pointer-events-none fixed inset-x-0 top-5 z-[300] flex justify-center px-4" role="status" aria-live="polite">
        <div className="cel-toast flex items-center gap-3 rounded-full border border-white/10 bg-[#141417]/95 py-2 pl-2 pr-5 text-[15px] font-medium text-[#f5f4f0] shadow-[0_20px_50px_-15px_rgba(255,91,31,.55)] backdrop-blur">
          <span className="relative grid h-8 w-8 place-items-center rounded-full bg-[#ff5b1f]">
            <span className="cel-ring absolute inset-0 rounded-full border-2 border-[#ff5b1f]" />
            <Check size={16} />
          </span>
          {ev.message}
        </div>
      </div>
    );
  }

  return (
    <div key={ev.id} className="cel-veil pointer-events-none fixed inset-0 z-[300] grid place-items-center" role="status" aria-live="polite">
      <div className="relative grid place-items-center">
        {[0, 1, 2].map((i) => (
          <span key={i} className="cel-wave absolute h-40 w-40 rounded-full border border-[#ff5b1f]" style={{ animationDelay: `${i * 0.18}s` }} />
        ))}
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={`s${i}`} className="cel-spark absolute h-1.5 w-1.5 rounded-full bg-[#ff5b1f]"
            style={{ "--a": `${(360 / 14) * i}deg`, "--r": `${110 + (i % 3) * 28}px`, animationDelay: `${0.12 + (i % 4) * 0.03}s` } as React.CSSProperties} />
        ))}
        <span className="cel-badge relative grid h-24 w-24 place-items-center rounded-full bg-[#ff5b1f] text-white shadow-[0_0_80px_10px_rgba(255,91,31,.45)]">
          <Check size={42} draw />
        </span>
        <p className="cel-text absolute top-[calc(100%+28px)] w-[80vw] max-w-sm text-center font-display text-2xl font-bold tracking-tight text-[#f5f4f0]">
          {ev.message}
        </p>
      </div>
    </div>
  );
}

function Check({ size, draw }: { size: number; draw?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" className={draw ? "cel-check" : ""} />
    </svg>
  );
}
