import { Logo } from "@/components/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grain flex min-h-dvh flex-col px-5 py-6">
      <Logo />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
    </main>
  );
}
