"use client";

import { SAMPLE_FLOOR } from "@/lib/site/floor";

import { useRef, useState } from "react";
import type { FloorTable } from "@/lib/site/schema";

/* Plan de salle : le commerçant place ses tables en les faisant glisser du doigt.
   Ses clients choisiront ensuite leur table en réservant, comme une place de cinéma. */

type Props = {
  enabled: boolean;
  tables: FloorTable[];
  busy: boolean;
  onSave: (floor: { enabled: boolean; tables: FloorTable[] }) => Promise<void>;
};

const SAMPLE = SAMPLE_FLOOR;

const SIZE: Record<FloorTable["shape"], string> = {
  rond: "w-[15%] aspect-square rounded-full",
  carre: "w-[16%] aspect-square rounded-lg",
  long: "w-[28%] aspect-[2/1] rounded-xl",
};

export function FloorEditor({ enabled, tables: initial, busy, onSave }: Props) {
  const [tables, setTables] = useState<FloorTable[]>(initial);
  const [sel, setSel] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; moved: boolean } | null>(null);

  const change = (next: FloorTable[]) => { setTables(next); setDirty(true); };
  const upd = (id: string, patch: Partial<FloorTable>) => change(tables.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const selected = tables.find((t) => t.id === sel) ?? null;

  function add(shape: FloorTable["shape"], seats: number) {
    const n = tables.length + 1;
    const id = Math.random().toString(36).slice(2, 8);
    const label = `T${Math.max(n, ...tables.map((t) => Number(t.label.replace(/\D/g, "")) + 1 || 0))}`;
    change([...tables, { id, label, seats, shape, x: 50, y: 50, zone: "" }]);
    setSel(id);
  }

  function move(e: React.PointerEvent) {
    const d = drag.current;
    const r = box.current?.getBoundingClientRect();
    if (!d || !r) return;
    d.moved = true;
    const x = Math.min(94, Math.max(6, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.min(92, Math.max(8, ((e.clientY - r.top) / r.height) * 100));
    setTables((ts) => ts.map((t) => (t.id === d.id ? { ...t, x: Math.round(x), y: Math.round(y) } : t)));
    setDirty(true);
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">Plan de salle</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">Vos clients choisissent leur table en réservant, comme une place de cinéma. Les tables déjà prises sont grisées.</p>
        </div>
        <button type="button" role="switch" aria-checked={enabled} aria-label="Plan de salle" disabled={busy}
          onClick={() => onSave({ enabled: !enabled, tables: tables.length ? tables : SAMPLE }).then(() => { if (!tables.length) setTables(SAMPLE); setDirty(false); })}
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${enabled ? "bg-clic" : "bg-white/15"}`}>
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${enabled ? "left-6" : "left-1"}`} />
        </button>
      </div>

      {enabled && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-muted">Faites glisser les tables du doigt. Touchez une table pour la modifier.</p>
          <div ref={box} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }}
            className="relative aspect-[4/3] touch-none select-none overflow-hidden rounded-xl border border-line"
            style={{ background: "radial-gradient(circle at 1px 1px, rgba(255,255,255,.12) 1px, transparent 0) 0 0/18px 18px, #141416" }}>
            {tables.map((t) => (
              <button key={t.id} type="button"
                onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); drag.current = { id: t.id, moved: false }; setSel(t.id); }}
                className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-content-center border-2 text-center transition-colors ${SIZE[t.shape]} ${
                  sel === t.id ? "border-clic bg-clic text-white shadow-[0_8px_24px_-6px_var(--clic)]" : "border-white/30 bg-[#232326] text-white"}`}
                style={{ left: `${t.x}%`, top: `${t.y}%` }}>
                <span className="text-xs font-semibold leading-none">{t.label}</span>
                <span className="text-[9px] leading-tight opacity-70">{t.seats} pl.</span>
              </button>
            ))}
            {!tables.length && (
              <button type="button" onClick={() => change(SAMPLE)} className="absolute inset-0 m-auto h-fit w-fit rounded-full bg-clic px-4 py-2 text-sm font-medium text-white">
                Commencer avec un plan exemple
              </button>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => add("rond", 2)} className="rounded-full border border-line px-3 py-1.5 text-xs hover:border-ink/50">+ Table ronde (2)</button>
            <button type="button" onClick={() => add("carre", 4)} className="rounded-full border border-line px-3 py-1.5 text-xs hover:border-ink/50">+ Table carrée (4)</button>
            <button type="button" onClick={() => add("long", 6)} className="rounded-full border border-line px-3 py-1.5 text-xs hover:border-ink/50">+ Grande table (6)</button>
          </div>

          {selected && (
            <div className="mt-3 grid gap-2 rounded-xl border border-clic/30 bg-clic/5 p-3">
              <div className="flex items-center gap-2">
                <label className="flex-1 text-xs text-muted">Nom
                  <input value={selected.label} maxLength={20} onChange={(e) => upd(selected.id, { label: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-line bg-cream px-2.5 py-2 text-sm text-ink outline-none" />
                </label>
                <label className="flex-1 text-xs text-muted">Coin (facultatif)
                  <input value={selected.zone} maxLength={30} placeholder="Terrasse, fenêtre…" onChange={(e) => upd(selected.id, { zone: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-line bg-cream px-2.5 py-2 text-sm text-ink outline-none" />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">Places</span>
                <button type="button" onClick={() => upd(selected.id, { seats: Math.max(1, selected.seats - 1) })} className="h-8 w-8 rounded-full border border-line">−</button>
                <span className="w-6 text-center text-sm">{selected.seats}</span>
                <button type="button" onClick={() => upd(selected.id, { seats: Math.min(20, selected.seats + 1) })} className="h-8 w-8 rounded-full border border-line">+</button>
                <span className="ml-2 text-xs text-muted">Forme</span>
                {(["rond", "carre", "long"] as const).map((sh) => (
                  <button key={sh} type="button" onClick={() => upd(selected.id, { shape: sh })}
                    className={`rounded-full border px-2.5 py-1 text-xs ${selected.shape === sh ? "border-clic text-ink" : "border-line text-muted"}`}>
                    {sh === "rond" ? "Ronde" : sh === "carre" ? "Carrée" : "Longue"}
                  </button>
                ))}
                <button type="button" onClick={() => { change(tables.filter((t) => t.id !== selected.id)); setSel(null); }}
                  className="ml-auto text-xs text-red-400 underline underline-offset-4">Supprimer</button>
              </div>
            </div>
          )}

          <button type="button" disabled={busy || !dirty || tables.some((t) => !t.label.trim())}
            onClick={() => onSave({ enabled: true, tables }).then(() => setDirty(false))}
            className="mt-3 w-full rounded-full bg-clic py-2.5 text-sm font-medium text-white disabled:opacity-40">
            {dirty ? "Enregistrer le plan" : "Plan enregistré ✓"}
          </button>
        </div>
      )}
    </div>
  );
}
