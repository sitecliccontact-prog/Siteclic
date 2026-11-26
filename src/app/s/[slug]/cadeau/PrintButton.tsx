"use client";

export function PrintButton({ label = "Imprimer" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="rounded-full bg-[#ff5b1f] px-5 py-2.5 text-sm font-medium text-white">
      {label}
    </button>
  );
}
