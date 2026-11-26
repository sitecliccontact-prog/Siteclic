"use client";

import { useEffect, useState } from "react";
import type { SiteContent } from "@/lib/site/schema";

type State = { enabled: boolean; connected: boolean; ready: boolean };
type Mode = "aucun" | "empreinte" | "acompte";

/** Garantie des réservations : empreinte bancaire (recommandé) ou acompte, encaissés sur le compte Stripe du restaurant. */
export function GuaranteeCard({ id, content, busy, onSave }: {
  id: string; content: SiteContent; busy: boolean;
  onSave: (pay: { mode: Mode; perPerson: number }) => Promise<void>;
}) {
  const pay = content.booking?.pay;
  const [mode, setMode] = useState<Mode>(pay?.mode ?? "aucun");
  const [amount, setAmount] = useState(pay?.perPerson || 20);
  const [state, setState] = useState<State | null>(null);
  const [opening, setOpening] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/paiements").then((r) => r.json()).then(setState).catch(() => setState(null));
  }, []);

  async function connect() {
    setOpening(true);
    setErr("");
    const res = await fetch("/api/paiements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ retour: `/tableau-de-bord/sites/${id}` }) }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    if (res?.ok && d?.url) { window.location.href = d.url; return; }
    setErr(d?.error || "Impossible d'ouvrir Stripe. Réessayez.");
    setOpening(false);
  }

  const dirty = mode !== (pay?.mode ?? "aucun") || (mode !== "aucun" && amount !== (pay?.perPerson ?? 0));
  const live = mode !== "aucun" && Boolean(pay?.account) && pay?.mode === mode;

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <p className="font-medium">Garantir les réservations</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Fini les tables vides : le client enregistre sa carte en réservant. S&apos;il ne vient pas sans prévenir, vous prélevez le montant prévu en un bouton, depuis vos réservations.
      </p>

      <div className="mt-3 grid grid-cols-3 gap-1 rounded-full border border-line p-1 text-xs">
        {([["aucun", "Aucune"], ["empreinte", "Empreinte"], ["acompte", "Acompte"]] as const).map(([m, label]) => (
          <button key={m} type="button" onClick={() => setMode(m)}
            className={`rounded-full py-2 ${mode === m ? "bg-clic text-white" : "text-muted"}`}>{label}</button>
        ))}
      </div>
      {mode !== "aucun" && (
        <>
          <p className="mt-2 text-xs text-muted">
            {mode === "empreinte"
              ? "Recommandé. Rien n'est débité : la carte est seulement enregistrée. Vous ne prélevez qu'en cas d'absence."
              : "Le client paie l'acompte tout de suite. Vous le déduisez de l'addition."}
          </p>
          <label className="mt-3 flex items-center gap-3 text-sm">
            <span className="text-muted">Montant par personne</span>
            <input type="number" min={1} max={500} value={amount} onChange={(e) => setAmount(Math.max(0, Math.min(500, +e.target.value || 0)))}
              className="w-20 rounded-xl border border-line bg-cream px-3 py-2 text-right outline-none" />
            <span>€</span>
          </label>
        </>
      )}

      {mode !== "aucun" && state && (
        <div className="mt-3 rounded-xl bg-clic/5 p-3 text-xs leading-relaxed">
          {!state.enabled ? (
            <p>Le paiement en ligne s&apos;active très bientôt. Vos réglages sont gardés et s&apos;appliqueront tout seuls.</p>
          ) : state.ready ? (
            <p>✓ Votre compte Stripe est relié. L&apos;argent arrive directement sur votre compte bancaire.</p>
          ) : (
            <>
              <p>Pour recevoir l&apos;argent, reliez votre compte bancaire (5 minutes, chez Stripe, sécurisé).</p>
              <button type="button" onClick={connect} disabled={opening}
                className="mt-2 w-full rounded-full border border-clic py-2 font-medium text-clic disabled:opacity-50">
                {opening ? "Ouverture…" : state.connected ? "Terminer mon inscription Stripe" : "Relier mon compte bancaire"}
              </button>
            </>
          )}
          <p className="mt-2 text-muted">Frais de service SiteClic : 2 % des montants encaissés.</p>
        </div>
      )}
      {err && <p className="mt-2 text-xs text-red-400">{err}</p>}

      <button type="button" disabled={busy || !dirty} onClick={() => onSave({ mode, perPerson: amount })}
        className="mt-3 w-full rounded-full bg-clic py-2.5 text-sm font-medium text-white disabled:opacity-40">
        Enregistrer
      </button>
      {live && <p className="mt-2 text-center text-xs text-muted">Actif sur votre site ✓</p>}
    </div>
  );
}
