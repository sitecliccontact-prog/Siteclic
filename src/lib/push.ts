import "server-only";
import { createECDH, createHash, createHmac } from "node:crypto";
import webpush from "web-push";
import { createClient as createAnon } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseReady, supabaseUrl } from "@/lib/supabase/config";

/* Notifications sur le téléphone du commerçant (Web Push).
   Les clés viennent de VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY si elles existent, sinon elles sont dérivées
   de la clé secrète déjà présente sur le serveur : aucune nouvelle variable à ajouter dans Vercel. */

const b64url = (b: Buffer) => b.toString("base64url");

function rootSecret() {
  return process.env.VAPID_PRIVATE_KEY || process.env.ANTHROPIC_API_KEY || "";
}

let keys: { publicKey: string; privateKey: string } | null = null;
export function vapidKeys() {
  if (keys) return keys;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    return keys;
  }
  const secret = rootSecret();
  if (!secret) return null;
  const priv = createHmac("sha256", secret).update("siteclic-vapid-v1").digest();
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(priv);
  keys = { publicKey: b64url(ecdh.getPublicKey()), privateKey: b64url(priv) };
  return keys;
}

/** Clé que le serveur présente à la base pour lire les téléphones des commerçants. */
export function serverKey() {
  const secret = rootSecret();
  return secret ? createHmac("sha256", secret).update("siteclic-server-v1").digest("hex") : "";
}
export const serverKeyHash = () => createHash("sha256").update(serverKey()).digest("hex");

function anon() {
  return createAnon(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
}

type Target = { endpoint: string; p256dh: string; auth: string };
type Note = { title: string; body: string; url?: string; tag?: string };

export async function sendTo(targets: Target[], note: Note) {
  const k = vapidKeys();
  if (!k || !targets.length) return;
  const db = anon();
  const key = serverKey();
  await Promise.all(targets.map(async (t) => {
    try {
      await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, JSON.stringify(note), {
        vapidDetails: { subject: "https://siteclic.vercel.app", publicKey: k.publicKey, privateKey: k.privateKey },
        TTL: 60 * 60 * 12,
        urgency: "high",
      });
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      // Téléphone désabonné ou appli désinstallée : on l'oublie.
      if (code === 404 || code === 410) await db.rpc("push_forget", { p_key: key, p_endpoint: t.endpoint });
    }
  }));
}

/** Prévient le commerçant d'un site (nouvelle réservation, commande…). Ne fait jamais échouer la demande du client. */
export async function notifyOwner(slug: string | undefined, note: Note) {
  if (!slug || !supabaseReady || slug.startsWith("exemple-")) return;
  try {
    const { data } = await anon().rpc("push_targets", { p_key: serverKey(), p_slug: slug });
    await sendTo((data as Target[] | null) ?? [], note);
  } catch (e) {
    console.error("Notification", e);
  }
}

/** « ven. 12 déc. à 20h » */
export function whenLabel(day: string, time?: string) {
  const d = new Date(`${day}T12:00:00Z`);
  const s = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(d);
  return time ? `${s} à ${time.replace(":", "h")}` : s;
}
