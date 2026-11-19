import Link from "next/link";

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#12131a" />
      <path d="M22 18 L22 44 L29 37.5 L34 48 L39 45.6 L34 35.2 L43 34.6 Z" fill="#faf7f2" />
      <circle cx="46" cy="18" r="5" fill="#e8572a" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="SiteClic, accueil">
      <LogoMark />
      <span className="font-display text-[1.35rem] font-semibold tracking-tight">
        Site<span className="text-clic">Clic</span>
      </span>
    </Link>
  );
}
