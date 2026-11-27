import { NextResponse } from "next/server";
import { z } from "zod";
import { sendTo, vapidKeys } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";

/* Notifications sur le téléphone du commerçant : clé publique, inscription du téléphone, notification d'essai. */

export async function GET() {
  const k = vapidKeys();
  if (!k) return NextResponse.json({ error: "Notifications indisponibles." }, { status: 503 });
  return NextResponse.json({ publicKey: k.publicKey });
}

const Body = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ce téléphone ne peut pas recevoir de notifications." }, { status: 400 });
  const s = parsed.data;
  const { error } = await supabase.rpc("push_save", { p_endpoint: s.endpoint, p_p256dh: s.keys.p256dh, p_auth: s.keys.auth });
  if (error) {
    console.error("Notifications", error);
    return NextResponse.json({ error: "Activation impossible pour le moment. (code NOTIF : code Supabase n°4 à passer ?)" }, { status: 503 });
  }
  await sendTo([{ endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth }], {
    title: "Notifications activées ✓",
    body: "Vous serez prévenu ici à chaque réservation, commande ou candidature.",
    url: "/tableau-de-bord", tag: "essai",
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });
  const endpoint = new URL(request.url).searchParams.get("endpoint") ?? "";
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}
