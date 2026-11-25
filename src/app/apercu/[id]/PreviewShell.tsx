"use client";

import Link from "next/link";
import { useEffect } from "react";
import { celebrate } from "@/components/Celebration";
import { PublishButton, type PublishState } from "@/components/PublishButton";

/** Cadre de l'aperçu gratuit : bandeau SiteClic, filigrane, copie désactivée. */
export function PreviewShell({ id, publish, clean, children }: { id: string; publish: PublishState; clean: boolean; children: React.ReactNode }) {
  // Juste après la création : petite célébration, puis on retire « ?nouveau=1 » de l'adresse.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("nouveau") !== "1") return;
    url.searchParams.delete("nouveau");
    window.history.replaceState(null, "", url.pathname + url.search);
    const t = setTimeout(() => celebrate("Votre site est prêt", "big"), 350);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      className={`min-h-dvh ${clean ? "" : "select-none"}`}
      onContextMenu={(e) => { if (!clean) e.preventDefault(); }}
      onCopy={(e) => { if (!clean) e.preventDefault(); }}
      onDragStart={(e) => { if (!clean) e.preventDefault(); }}
    >
      <div className="sticky top-0 z-50 flex items-center gap-3 border-b border-white/10 bg-[#0b0b0d] px-4 py-3 text-[#f5f4f0]">
        <Link href="/tableau-de-bord" className="text-sm text-white/60 hover:text-white">← Mes sites</Link>
        <p className="mx-auto hidden text-sm sm:block">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#ff5b1f]" />
          {clean ? "Aperçu de votre site" : "Aperçu gratuit de votre site"}
        </p>
        <Link href={`/tableau-de-bord/sites/${id}`} className="ml-auto rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium hover:border-white/50 sm:ml-0">
          Modifier
        </Link>
        <PublishButton id={id} initial={publish} compact />
      </div>
      <div className="relative">
        {children}
        {!clean && <div aria-hidden className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
          <div className="absolute -inset-[50%] flex rotate-[-24deg] flex-wrap content-start gap-x-24 gap-y-28 opacity-[0.07]">
            {Array.from({ length: 400 }).map((_, i) => (
              <span key={i} className="whitespace-nowrap text-2xl font-black uppercase tracking-[0.2em] text-[#808080]">
                Aperçu SiteClic
              </span>
            ))}
          </div>
        </div>}
      </div>
    </div>
  );
}
