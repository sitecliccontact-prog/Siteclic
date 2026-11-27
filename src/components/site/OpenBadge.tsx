"use client";

import { useEffect, useState } from "react";
import { openState, parseWeek, type OpenState } from "@/lib/site/open-now";

/** Pastille « Ouvert · jusqu'à 19h » calculée sur le téléphone du visiteur (heure de Paris), mise à jour chaque minute. */
export function OpenBadge({ hours, lang = "fr" }: { hours: { days: string; time: string }[]; lang?: "fr" | "en" }) {
  const [state, setState] = useState<OpenState | null>(null);
  const key = JSON.stringify(hours);
  useEffect(() => {
    const week = parseWeek(JSON.parse(key));
    if (!week) return setState(null);
    const tick = () => setState(openState(week, new Date(), lang));
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [key, lang]);
  if (!state) return null;
  return (
    <b className={`s-open ${state.open ? (state.soon ? "is-soon" : "is-open") : "is-closed"}`} role="status">
      <i aria-hidden />{state.label}
    </b>
  );
}
